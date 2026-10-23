import { bookSchema, type Book } from "@/lib/schemas/book";

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
}

interface OpenLibrarySearchResponse {
  docs: OpenLibraryDoc[];
}

// Open Library work ids look like "OL893414W"
const WORK_ID_PATTERN = /^OL\d+W$/;

async function queryOpenLibrary(query: string, limit: number): Promise<Book[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i");
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
  }));

  return bookSchema.array().parse(books);
}

export async function searchBooks(query: string): Promise<Book[]> {
  return queryOpenLibrary(query, 10);
}

export async function getBookById(id: string): Promise<Book | null> {
  if (!WORK_ID_PATTERN.test(id)) return null;

  const [book] = await queryOpenLibrary(`key:/works/${id}`, 1);
  return book ?? null;
}
