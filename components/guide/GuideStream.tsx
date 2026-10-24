"use client";

import { useObject } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { GuideBody, type ViewSection, type ViewTopic } from "@/components/guide/GuideBody";
import { GuideHeader } from "@/components/guide/GuideHeader";
import { plural, type Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { Book } from "@/lib/schemas/book";
import { generatedGuideSchema, SECTIONS, type Section, type Stage } from "@/lib/schemas/guide";

// A typical guide: 3 sections of 2 topics plus a few further topics
const EXPECTED_TOPICS = 10;
// The title creeps up to this while the model hasn't sent a topic yet
const THINKING_PROGRESS = 10;

type PartialTopic = { title?: string; whyItMatters?: string } | undefined;

function toViewTopics(topics: PartialTopic[] | undefined): ViewTopic[] {
  return (topics ?? []).flatMap((topic) =>
    topic?.title ? [{ title: topic.title, whyItMatters: topic.whyItMatters }] : []
  );
}

// Generates a guide that isn't stored yet, showing topics as they arrive.
// The route stores the finished guide before closing the stream, so a
// refresh then renders the stored guide with its links in place of this.
export function GuideStream({
  book,
  stage,
  locale,
  dict,
}: {
  book: Book;
  stage: Stage;
  locale: Locale;
  dict: Pick<Dictionary, "guide" | "book" | "sections">;
}) {
  const router = useRouter();
  const { object, submit, error, isLoading } = useObject({
    api: "/api/guide",
    schema: generatedGuideSchema,
    onFinish: ({ error }) => {
      if (!error) router.refresh();
    },
  });

  const start = useCallback(
    () => submit({ bookId: book.id, stage, locale }),
    [submit, book.id, stage, locale]
  );

  // Strict Mode mounts twice in development; one generation is enough
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

  const sections: ViewSection[] = (object?.sections ?? []).flatMap((section) =>
    section?.name && (SECTIONS as readonly string[]).includes(section.name)
      ? [{ name: section.name as Section, topics: toViewTopics(section.topics) }]
      : []
  );
  const further = toViewTopics(object?.furtherExploration);
  const topicCount = sections.reduce((n, s) => n + s.topics.length, 0) + further.length;

  // Real progress: topics received out of a typical guide's count
  const [thinking, setThinking] = useState(0);
  useEffect(() => {
    if (topicCount > 0 || !isLoading) return;
    const timer = setInterval(() => setThinking((p) => Math.min(THINKING_PROGRESS, p + 1)), 300);
    return () => clearInterval(timer);
  }, [topicCount, isLoading]);

  const done = !isLoading && !error && object !== undefined;
  const progress = done
    ? 100
    : topicCount === 0
      ? thinking
      : Math.min(95, THINKING_PROGRESS + (topicCount / EXPECTED_TOPICS) * 85);

  return (
    <>
      <GuideHeader book={book} stage={stage} locale={locale} dict={dict} progress={error ? 0 : progress} />

      <p role="status" className="label-mono m-0 px-gutter pt-8 text-concrete">
        {error
          ? dict.guide.error
          : `${dict.guide.loading} — ${plural(locale, topicCount, dict.guide.loadingTopics)}`}
      </p>
      {error && (
        <div className="px-gutter pt-4">
          <button
            type="button"
            onClick={start}
            className="poster cursor-pointer bg-ink px-6 py-3 text-2xl leading-none text-paper transition-colors hover:bg-signal"
          >
            {dict.guide.retry}
          </button>
        </div>
      )}

      <GuideBody sections={sections} further={further} locale={locale} bookId={book.id} stage={stage} dict={dict} />
    </>
  );
}
