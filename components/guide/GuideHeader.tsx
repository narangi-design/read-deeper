import Link from "next/link";
import { BookCover } from "@/components/BookCover";
import { posterTitleSize } from "@/components/PosterTitle";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { displayAuthor, displayTitle, type Book } from "@/lib/schemas/book";
import { STAGES, type Stage } from "@/lib/schemas/guide";

// Book strip above the guide. With `progress` (0–100) the title is drawn as
// an outline that fills with red as the guide streams in.
export function GuideHeader({
  book,
  stage,
  locale,
  dict,
  progress,
}: {
  book: Book;
  stage: Stage;
  locale: Locale;
  dict: Pick<Dictionary, "guide" | "book">;
  progress?: number;
}) {
  const title = displayTitle(book, locale);
  const size = posterTitleSize(title, "header");
  const coords = [book.id, book.year, displayAuthor(book, locale)].filter(Boolean).join(" — ");

  return (
    <section
      aria-labelledby="book-title"
      className="flex flex-wrap items-end gap-x-12 gap-y-8 px-gutter pt-12 pb-4"
    >
      <BookCover url={book.coverUrl} alt={`${dict.book.cover} ${title}`} size="small" />

      <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-3">
        <p className="label-mono m-0 text-concrete">{coords}</p>
        {progress === undefined ? (
          <h1 id="book-title" className={`poster m-0 text-balance text-signal ${size}`}>
            {title}
          </h1>
        ) : (
          <h1 id="book-title" className={`poster relative m-0 text-balance ${size}`}>
            <span className="text-ink/10">{title}</span>
            <span
              aria-hidden="true"
              className="absolute inset-0 text-signal transition-[clip-path] duration-500 ease-out motion-reduce:transition-none"
              // Poster type overflows its tight line box (Й, Д, Щ): the clip
              // reaches past the box so no tail of a letter stays unfilled
              style={{ clipPath: `inset(-0.3em ${progress >= 100 ? "-0.1em" : `${100 - progress}%`} -0.3em -0.1em)` }}
            >
              {title}
            </span>
          </h1>
        )}
        <p className="poster-thin m-0 mt-2 text-[28px] leading-[1.1]">{dict.guide.summary[stage]}</p>
      </div>

      <nav
        aria-label={dict.guide.stageNav}
        className="poster flex border-4 border-ink text-xl leading-none font-extrabold"
      >
        {STAGES.map((target) => (
          <Link
            key={target}
            href={`/${locale}/book/${book.id}/guide?stage=${target}`}
            aria-current={target === stage ? "page" : undefined}
            className={`px-5 py-3 no-underline ${target === stage ? "bg-ink text-paper hover:text-paper" : ""}`}
          >
            {dict.guide.stage[target]}
          </Link>
        ))}
      </nav>
    </section>
  );
}
