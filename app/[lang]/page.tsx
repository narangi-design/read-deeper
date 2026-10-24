import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/BookCover";
import { searchBooks } from "@/lib/books/search";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/locales";
import { displayTitle, type Book } from "@/lib/schemas/book";

// Search lives in the URL (?q=), so results can be refreshed and shared
export default async function SearchPage({ params, searchParams }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  let books: Book[] | null = null;
  let failed = false;
  if (query) {
    try {
      books = await searchBooks(query, lang);
    } catch {
      failed = true;
    }
  }

  return (
    <main className="flex flex-col gap-12 px-gutter pt-12 pb-24">
      <section className="flex flex-col gap-6">
        <h1 className="poster m-0 text-[clamp(72px,14vw,200px)] text-signal">{dict.search.title}</h1>
        <p className="poster-thin m-0 max-w-3xl text-[clamp(24px,3vw,40px)]">{dict.search.tagline}</p>

        <form action={`/${lang}`} role="search" className="flex max-w-3xl flex-wrap border-4 border-ink">
          <label htmlFor="q" className="sr-only">
            {dict.search.label}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder={dict.search.placeholder}
            className="min-w-0 flex-[1_1_280px] bg-transparent px-5 py-4 text-xl placeholder:text-concrete focus-visible:outline-offset-0"
          />
          <button
            type="submit"
            className="poster cursor-pointer bg-ink px-8 py-4 text-[28px] leading-none text-paper transition-colors hover:bg-signal"
          >
            {dict.search.submit}
          </button>
        </form>
      </section>

      {failed && <p className="label-mono m-0">{dict.search.error}</p>}
      {books?.length === 0 && <p className="label-mono m-0">{dict.search.noResults}</p>}

      {books && books.length > 0 && (
        <section aria-labelledby="results" className="flex flex-col gap-6">
          <h2 id="results" className="label-mono m-0 border-b-[3px] border-ink pb-3">
            {dict.search.results}
          </h2>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-x-8 gap-y-12 p-0">
            {books.map((book) => (
              <li key={book.id}>
                <Link href={`/${lang}/book/${book.id}`} className="group flex flex-col gap-4 no-underline">
                  <BookCover url={book.coverUrl} alt="" size="small" />
                  <span className="poster text-[30px] leading-[0.95] group-hover:text-signal">{displayTitle(book, lang)}</span>
                  <span className="label-mono text-concrete">
                    {book.author}
                    {book.year && ` — ${book.year}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
