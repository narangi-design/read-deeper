import { findWorksByTitle, getWorkNames, type WikidataWork } from "@/lib/books/wikidata";
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
// Wikidata links are sometimes wrong ("Lolita" → "Lolita. A Screenplay", 4
// editions). A linked work with a different title and fewer editions than
// this is checked against a lookup by the English title.
const SUSPECT_EDITION_COUNT = 20;
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
        return book && { ...book, titles: work.titles, authors: work.authors };
      })
    ),
  ]);

  const names = new Map(linked.map((work) => [work.workId, work]));
  const linkedBooks = await Promise.all(
    byId.map(async (book): Promise<Book[]> => {
      const work = names.get(book.id);
      const named = { ...book, titles: work?.titles ?? {}, authors: work?.authors ?? {} };
      const english = work?.titles.en;
      const suspect =
        english && !sameTitle(book.title, english) && book.editionCount < SUSPECT_EDITION_COUNT;
      if (!suspect) return [named];

      const better = await getBookByTitle(english).catch(() => null);
      const isBetter =
        better && better.id !== book.id && sameTitle(better.title, english) && better.editionCount > book.editionCount;
      // The link was wrong: the names belong to the better match, and the
      // linked work keeps its own catalogue title
      return isBetter ? [{ ...better, titles: named.titles, authors: named.authors }, book] : [named];
    })
  );
  const books = [...linkedBooks.flat(), ...byTitle.flatMap((book) => book ?? [])];
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

function sameTitle(a: string, b: string): boolean {
  return [...words(a)].join(" ") === [...words(b)].join(" ");
}

// Open Library answers an unfamiliar query with loosely related books
// ("Бледный огонь" → "Нацистские врачи"); keep those sharing a word with it
function sharesWord(query: string, book: Book): boolean {
  const bookWords = words(`${book.title} ${book.author}`);
  return [...words(query)].some((word) => bookWords.has(word));
}

// Catalogue results get their title and author in the UI languages too,
// whatever language the query was in. Missing names aren't worth failing for.
async function withNames(books: Book[]): Promise<Book[]> {
  const names = await getWorkNames(books.map((book) => book.id)).catch(() => new Map());
  return books.map((book) => ({ ...book, ...names.get(book.id) }));
}

// Wikidata finds works by translated titles ("В ожидании Годо") and comes
// first; Open Library's own search adds what Wikidata doesn't know.
// Fails only when both sources fail. Results are kept in Redis for a day.
export async function searchBooks(query: string, locale: Locale): Promise<Book[]> {
  const key = `search:v2:${locale}:${query.toLowerCase().replace(/\s+/g, " ")}`;
  const cached = bookSchema.array().safeParse(await redis.get(key).catch(() => null));
  if (cached.success) return cached.data;

  const [works, catalogue] = await Promise.allSettled([
    booksFromWikidata(query, locale),
    queryOpenLibrary(query, SEARCH_LIMIT, CATALOGUE_TIMEOUT_MS).then((books) =>
      withNames(books.filter((book) => sharesWord(query, book)))
    ),
  ]);
  if (works.status === "rejected" && catalogue.status === "rejected") throw catalogue.reason;

  const fromWikidata = works.status === "fulfilled" ? works.value : [];
  const known = new Set(fromWikidata.map((book) => book.id));
  const fromCatalogue = catalogue.status === "fulfilled" ? catalogue.value : [];
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
  await rememberBooks(books);
  return books;
}

// Every book, guide and topic page looks the book up, and Open Library takes
// up to a few seconds — so lookups are kept in Redis for a week.
// Bump the key version when the stored Book shape changes.
const BOOK_TTL_SECONDS = 7 * 24 * 60 * 60;

function bookKey(id: string): string {
  return `book:v3:${id}`;
}

// Search may find a book's names by a route the book page can't retrace
// (a Wikidata item linked to another Open Library work): remember them
async function rememberBooks(books: Book[]): Promise<void> {
  const named = books.filter((book) => Object.keys(book.titles).length > 0);
  if (named.length === 0) return;
  const pipeline = redis.pipeline();
  for (const book of named) pipeline.set(bookKey(book.id), book, { ex: BOOK_TTL_SECONDS });
  await pipeline.exec().catch(() => {});
}

// Names for a work Wikidata doesn't link to directly: an item with the same
// English title, as search finds it
async function namesByTitle(book: Book): Promise<Partial<Pick<Book, "titles" | "authors">>> {
  const sameTitle = (title: string) => title.toLowerCase() === book.title.toLowerCase();
  const works = await findWorksByTitle(book.title, "en");
  const match = works.find((work) => work.workId === book.id || (work.workId === null && sameTitle(work.englishTitle)));
  return match ? { titles: match.titles, authors: match.authors } : {};
}

export async function getBookById(id: string): Promise<Book | null> {
  if (!WORK_ID_PATTERN.test(id)) return null;

  const cached = bookSchema.safeParse(await redis.get(bookKey(id)).catch(() => null));
  if (cached.success) return cached.data;

  const [[found], names] = await Promise.all([
    queryOpenLibrary(`key:/works/${id}`, 1),
    getWorkNames([id]).catch(() => new Map()),
  ]);
  if (!found) return null;

  const book: Book = { ...found, ...(names.get(id) ?? (await namesByTitle(found).catch(() => ({})))) };
  await redis.set(bookKey(id), book, { ex: BOOK_TTL_SECONDS }).catch(() => {});
  return book;
}
