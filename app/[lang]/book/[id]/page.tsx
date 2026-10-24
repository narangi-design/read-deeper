import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/BookCover";
import { PosterTitle } from "@/components/PosterTitle";
import { getBookById } from "@/lib/books/search";
import { getDictionary, plural } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/locales";
import { displayAuthor, displayTitle } from "@/lib/schemas/book";

export async function generateMetadata({ params }: PageProps<"/[lang]/book/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  const book = await getBookById(id);
  return book && isLocale(lang) ? { title: displayTitle(book, lang) } : {};
}

export default async function BookPage({ params }: PageProps<"/[lang]/book/[id]">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  const book = await getBookById(id);
  if (!book) notFound();
  const dict = getDictionary(lang);
  const title = displayTitle(book, lang);

  const coords = [book.id, book.year, plural(lang, book.editionCount, dict.book.editions)]
    .filter(Boolean)
    .join(" — ");
  const stages = [
    { stage: "before", text: dict.book.before, className: "bg-ink text-paper" },
    { stage: "after", text: dict.book.after, className: "bg-paper text-ink" },
  ] as const;

  return (
    <main className="flex flex-col gap-10 overflow-hidden px-gutter pt-12 pb-18">
      <div className="flex flex-col gap-2">
        <p className="label-mono m-0 text-concrete">{coords}</p>
        <PosterTitle title={title} variant="hero" />
      </div>

      <div className="flex flex-wrap items-start gap-12">
        <div className="flex max-w-[640px] flex-[1_1_420px] flex-col gap-10">
          <p className="poster-thin m-0 text-[clamp(36px,4vw,56px)]">{displayAuthor(book, lang)}</p>

          <section aria-labelledby="stage-question" className="flex flex-col gap-4">
            <h2 id="stage-question" className="poster m-0 max-w-[14ch] text-[32px] leading-[1.05] font-extrabold">
              {dict.book.question}
            </h2>
            <div className="flex flex-wrap border-4 border-ink">
              {stages.map(({ stage, text, className }) => (
                <Link
                  key={stage}
                  href={`/${lang}/book/${book.id}/guide?stage=${stage}`}
                  className={`flex flex-[1_1_240px] flex-col gap-2.5 p-6 no-underline transition-colors hover:bg-signal hover:text-paper ${className}`}
                >
                  <span className="label-mono text-xs">{text.step}</span>
                  <span className="poster text-[40px] leading-[0.9]">{text.title}</span>
                  <span className="text-[15px] leading-snug">{text.hint}</span>
                </Link>
              ))}
            </div>
            <Link href={`/${lang}`} className="label-mono normal-case tracking-normal">
              {dict.book.wrongBook}
            </Link>
          </section>
        </div>

        <BookCover url={book.coverUrl} alt={`${dict.book.cover} ${title}`} size="large" />
      </div>
    </main>
  );
}
