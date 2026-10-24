import { findWorksByTitle, getWorkTitles, type WikidataWork } from "@/lib/books/wikidata";
import type { Locale } from "@/lib/i18n/locales";
import { bookSchema, type Book } from "@/lib/schemas/book";
import { redis } from "@/lib/storage/redis";

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  edition_count?: number;
}

interface OpenLibrarySearchResponse {
  docs: OpenLibraryDoc[];
}

// Open Library work ids look like "OL893414W"
const WORK_ID_PATTERN = /^OL\d+W$/;

async function queryOpenLibrary(query: string, limit: number, timeoutMs?: number): Promise<Book[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i,edition_count");
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : undefined);
  if (!res.ok) {
    throw new Error(`Open Library search failed: ${res.status}`);
  }

  const data = (await res.json()) as OpenLibrarySearchResponse;

  const books = data.docs.map((doc) => ({
    id: doc.key.replace("/works/", ""),
    title: doc.title,
    author: doc.author_name?.[0] ?? "Unknown author",
    year: doc.first_publish_year ?? null,
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : null,
    editionCount: doc.edition_count ?? 0,
  }));

  return bookSchema.array().parse(books);
}

const SEARCH_LIMIT = 10;
// Open Library sometimes takes 10 s+. Its own text search only adds to what
// Wikidata finds, so it gets a shorter leash than the lookups Wikidata needs.
const CATALOGUE_TIMEOUT_MS = 5000;
const LOOKUP_TIMEOUT_MS = 8000;
// Wikidata works missing an Open Library link, looked up by English title
const MAX_TITLE_LOOKUPS = 3;
const SEARCH_TTL_SECONDS = 24 * 60 * 60;

type LinkedWork = Extract<WikidataWork, { workId: string }>;
type UnlinkedWork = Extract<WikidataWork, { workId: null }>;

// Books by Open Library work id
async function getBooksByIds(ids: string[]): Promise<Book[]> {
  if (ids.length === 0) return [];
  const keys = ids.map((id) => `/works/${id}`).join(" OR ");
  return queryOpenLibrary(`key:(${keys})`, ids.length, LOOKUP_TIMEOUT_MS);
}

// The most-published match for a title: the work, not a stray duplicate
async function getBookByTitle(title: string): Promise<Book | null> {
  const books = await queryOpenLibrary(title, 5, LOOKUP_TIMEOUT_MS);
  return books.reduce<Book | null>((best, book) => (!best || book.editionCount > best.editionCount ? book : best), null);
}

async function booksFromWikidata(query: string, locale: Locale): Promise<Book[]> {
  const works = await findWorksByTitle(query, locale);
  const linked = works.filter((work): work is LinkedWork => work.workId !== null);
  const unlinked = works
    .filter((work): work is UnlinkedWork => work.workId === null)
    .slice(0, MAX_TITLE_LOOKUPS);

  const [byId, byTitle] = await Promise.all([
    getBooksByIds(linked.map((work) => work.workId)),
    Promise.all(
      unlinked.map(async (work) => {
        const book = await getBookByTitle(work.englishTitle).catch(() => null);
        return book && { ...book, titles: work.titles };
      })
    ),
  ]);

  const titles = new Map(linked.map((work) => [work.workId, work.titles]));
  const books = [
    ...byId.map((book) => ({ ...book, titles: titles.get(book.id) ?? {} })),
    ...byTitle.flatMap((book) => book ?? []),
  ];
  // A series and its first book can point at the same work: keep the first
  // (direct links come before title lookups)
  const unique = books.filter((book, i) => books.findIndex((other) => other.id === book.id) === i);
  // Several Open Library works can match one title; the real one has the most editions
  return unique.sort((a, b) => b.editionCount - a.editionCount);
}

function words(text: string): Set<string> {
  return new Set(
    text
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 2)
  );
}

// Open Library answers an unfamiliar query with loosely related books
// ("Бледный огонь" → "Нацистские врачи"); keep those sharing a word with it
function sharesWord(query: string, book: Book): boolean {
  const bookWords = words(`${book.title} ${book.author}`);
  return [...words(query)].some((word) => bookWords.has(word));
}

// Wikidata finds works by translated titles ("В ожидании Годо") and comes
// first; Open Library's own search adds what Wikidata doesn't know.
// Fails only when both sources fail. Results are kept in Redis for a day.
export async function searchBooks(query: string, locale: Locale): Promise<Book[]> {
  const key = `search:v1:${locale}:${query.toLowerCase().replace(/\s+/g, " ")}`;
  const cached = bookSchema.array().safeParse(await redis.get(key).catch(() => null));
  if (cached.success) return cached.data;

  const [works, catalogue] = await Promise.allSettled([
    booksFromWikidata(query, locale),
    queryOpenLibrary(query, SEARCH_LIMIT, CATALOGUE_TIMEOUT_MS),
  ]);
  if (works.status === "rejected" && catalogue.status === "rejected") throw catalogue.reason;

  const fromWikidata = works.status === "fulfilled" ? works.value : [];
  const known = new Set(fromWikidata.map((book) => book.id));
  const fromCatalogue = (catalogue.status === "fulfilled" ? catalogue.value : []).filter((book) =>
    sharesWord(query, book)
  );
  const books = [...fromWikidata, ...fromCatalogue.filter((book) => !known.has(book.id))].slice(
    0,
    SEARCH_LIMIT
  );

  const failure = [works, catalogue].find((result) => result.status === "rejected");
  // Nothing found while a source timed out isn't "nothing exists" — say the search failed
  if (books.length === 0 && failure) throw failure.reason;

  // Keep only complete, non-empty answers
  if (!failure && books.length > 0) {
    await redis.set(key, books, { ex: SEARCH_TTL_SECONDS }).catch(() => {});
  }
  return books;
}

// Every book, guide and topic page looks the book up, and Open Library takes
// up to a few seconds — so lookups are kept in Redis for a week.
// Bump the key version when the stored Book shape changes.
const BOOK_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function getBookById(id: string): Promise<Book | null> {
  if (!WORK_ID_PATTERN.test(id)) return null;

  const key = `book:v2:${id}`;
  const cached = bookSchema.safeParse(await redis.get(key).catch(() => null));
  if (cached.success) return cached.data;

  const [[found], titles] = await Promise.all([
    queryOpenLibrary(`key:/works/${id}`, 1),
    getWorkTitles(id).catch(() => ({})),
  ]);
  if (!found) return null;

  const book = { ...found, titles };
  await redis.set(key, book, { ex: BOOK_TTL_SECONDS }).catch(() => {});
  return book;
}
