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

async function queryOpenLibrary(query: string, limit: number): Promise<Book[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i,edition_count");
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url);
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

export async function searchBooks(query: string): Promise<Book[]> {
  return queryOpenLibrary(query, 10);
}

// Every book, guide and topic page looks the book up, and Open Library takes
// up to a few seconds — so lookups are kept in Redis for a week
const BOOK_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function getBookById(id: string): Promise<Book | null> {
  if (!WORK_ID_PATTERN.test(id)) return null;

  const key = `book:${id}`;
  const cached = bookSchema.safeParse(await redis.get(key).catch(() => null));
  if (cached.success) return cached.data;

  const [book] = await queryOpenLibrary(`key:/works/${id}`, 1);
  if (book) await redis.set(key, book, { ex: BOOK_TTL_SECONDS }).catch(() => {});
  return book ?? null;
}
