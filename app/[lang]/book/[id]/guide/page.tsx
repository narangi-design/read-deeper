import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GuideBody } from "@/components/guide/GuideBody";
import { GuideHeader } from "@/components/guide/GuideHeader";
import { GuideStream } from "@/components/guide/GuideStream";
import { getBookById } from "@/lib/books/search";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/locales";
import { displayTitle } from "@/lib/schemas/book";
import { stageSchema } from "@/lib/schemas/guide";
import { getStoredGuide } from "@/lib/storage/generated";

export async function generateMetadata({ params }: PageProps<"/[lang]/book/[id]/guide">): Promise<Metadata> {
  const { lang, id } = await params;
  const book = await getBookById(id);
  return book && isLocale(lang) ? { title: displayTitle(book, lang) } : {};
}

// A stored guide renders right away; a new one streams in on the client
export default async function GuidePage({ params, searchParams }: PageProps<"/[lang]/book/[id]/guide">) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();

  const stage = stageSchema.safeParse((await searchParams).stage);
  if (!stage.success) redirect(`/${lang}/book/${id}`);

  const book = await getBookById(id);
  if (!book) notFound();
  const dict = getDictionary(lang);
  const guide = await getStoredGuide(book.id, stage.data, lang);

  return (
    <main className="flex flex-1 flex-col">
      {guide ? (
        <>
          <GuideHeader book={book} stage={stage.data} locale={lang} dict={dict} />
          {(!guide.familiar || guide.obscure) && (
            <p className="m-0 max-w-3xl px-gutter pt-8 text-lg leading-relaxed">
              {guide.familiar ? dict.guide.obscure : dict.guide.unfamiliar}
            </p>
          )}
          <GuideBody
            sections={guide.sections.map((section) => ({
              name: section.name,
              topics: section.topics.map((topic) => ({ ...topic, link: topic.startingPoint })),
            }))}
            further={guide.furtherExploration.map((topic) => ({ ...topic, link: topic.startingPoint }))}
            locale={lang}
            bookId={book.id}
            stage={stage.data}
            dict={dict}
          />
        </>
      ) : (
        <GuideStream book={book} stage={stage.data} locale={lang} dict={dict} />
      )}

      <footer className="label-mono mt-auto flex flex-wrap justify-between gap-3 px-gutter py-6 text-xs text-concrete">
        <span>{dict.guide.footer}</span>
        <span>{dict.guide.sources}</span>
      </footer>
    </main>
  );
}
