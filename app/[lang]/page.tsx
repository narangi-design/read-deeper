import Form from "next/form";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SearchResults, SearchResultsSkeleton } from "@/components/search/SearchResults";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/locales";

// Search lives in the URL (?q=), so results can be refreshed and shared.
// The form navigates on the client; results stream in behind a skeleton.
export default async function SearchPage({ params, searchParams }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  return (
    <main className="flex flex-col gap-12 px-gutter pt-12 pb-24">
      <section className="flex flex-col gap-6">
        <h1 className="poster m-0 text-[clamp(72px,14vw,200px)] text-signal">{dict.search.title}</h1>
        <p className="poster-thin m-0 max-w-3xl text-[clamp(24px,3vw,40px)]">{dict.search.tagline}</p>

        <Form action={`/${lang}`} role="search" className="flex max-w-3xl flex-wrap border-4 border-ink">
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
        </Form>
      </section>

      {query && (
        // A new query remounts the boundary, so the skeleton shows again
        <Suspense key={query} fallback={<SearchResultsSkeleton dict={dict} />}>
          <SearchResults query={query} locale={lang} dict={dict} />
        </Suspense>
      )}
    </main>
  );
}
