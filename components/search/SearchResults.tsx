import Link from "next/link";
import { BookCover } from "@/components/BookCover";
import { searchBooks } from "@/lib/books/search";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { displayAuthor, displayTitle, type Book } from "@/lib/schemas/book";

const GRID = "m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-x-8 gap-y-12 p-0";
const SKELETON_CARDS = 5;

// Rendered inside a Suspense boundary keyed by the query, so the page with
// the form shows at once and this streams in when the search answers
export async function SearchResults({
  query,
  locale,
  dict,
}: {
  query: string;
  locale: Locale;
  dict: Dictionary;
}) {
  let books: Book[];
  try {
    books = await searchBooks(query, locale);
  } catch {
    return <p className="label-mono m-0">{dict.search.error}</p>;
  }
  if (books.length === 0) return <p className="label-mono m-0">{dict.search.noResults}</p>;

  return (
    <section aria-labelledby="results" className="flex flex-col gap-6">
      <h2 id="results" className="label-mono m-0 border-b-[3px] border-ink pb-3">
        {dict.search.results}
      </h2>
      <ul className={GRID}>
        {books.map((book) => (
          <li key={book.id}>
            <Link href={`/${locale}/book/${book.id}`} className="group flex flex-col gap-4 no-underline">
              <BookCover url={book.coverUrl} alt="" size="small" />
              <span className="poster text-[30px] leading-[0.95] group-hover:text-signal">
                {displayTitle(book, locale)}
              </span>
              <span className="label-mono text-concrete">
                {displayAuthor(book, locale)}
                {book.year && ` — ${book.year}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Same grid as the results, with covers and titles as faint blocks
export function SearchResultsSkeleton({ dict }: { dict: Dictionary }) {
  return (
    <section aria-labelledby="results" className="flex flex-col gap-6">
      <h2 id="results" role="status" className="label-mono m-0 flex items-center gap-3 border-b-[3px] border-ink pb-3">
        <span aria-hidden="true" className="inline-block size-2.5 animate-pulse bg-signal motion-reduce:animate-none" />
        {dict.search.searching}
      </h2>
      <ul aria-hidden="true" className={GRID}>
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
          <li
            key={i}
            className="flex animate-pulse flex-col gap-4 motion-reduce:animate-none"
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <div className="relative h-[220px] w-[150px]">
              <div className="absolute top-0 -right-6 h-[170px] w-[130px] bg-signal/15" />
              <div className="absolute bottom-0 left-0 h-[200px] w-[130px] bg-ink/10" />
            </div>
            <div className="h-7 w-4/5 bg-ink/10" />
            <div className="h-3.5 w-1/2 bg-ink/10" />
          </li>
        ))}
      </ul>
    </section>
  );
}
