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
// While waiting, the fill keeps creeping toward the ceiling, covering this
// share of the remaining distance every tick — slower the closer it gets
const CREEP_CEILING = 97;
const CREEP_RATE = 0.008;
const CREEP_TICK_MS = 100;
// Gemini sometimes stops mid-answer (finish reason "other", likely a content
// filter); a second try usually goes through
const MAX_AUTO_RETRIES = 1;

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

  // A failed attempt retries silently; the error shows only after that
  const attempt = useRef(0);
  const handledAttempt = useRef(0);
  const retries = useRef(0);
  const retry = useRef<() => void>(() => {});
  const [gaveUp, setGaveUp] = useState(false);
  const [finished, setFinished] = useState(false);

  const handleFailure = () => {
    // onError and onFinish can both report the same failed attempt
    if (handledAttempt.current === attempt.current) return;
    handledAttempt.current = attempt.current;

    if (retries.current < MAX_AUTO_RETRIES) {
      retries.current += 1;
      retry.current();
    } else {
      setGaveUp(true);
    }
  };

  const { object, submit, isLoading } = useObject({
    api: "/api/guide",
    schema: generatedGuideSchema,
    onError: handleFailure,
    onFinish: ({ error }) => {
      if (error) {
        handleFailure();
      } else {
        setFinished(true);
        router.refresh();
      }
    },
  });

  const start = useCallback(() => {
    attempt.current += 1;
    setGaveUp(false);
    submit({ bookId: book.id, stage, locale });
  }, [submit, book.id, stage, locale]);

  useEffect(() => {
    retry.current = start;
  }, [start]);

  const retryByHand = () => {
    retries.current = 0;
    start();
  };

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

  // Real progress — topics received out of a typical guide's count — never
  // lets the fill stand still: it creeps on its own and jumps with each topic
  const received = Math.min(95, (topicCount / EXPECTED_TOPICS) * 95);
  const receivedRef = useRef(received);
  useEffect(() => {
    receivedRef.current = received;
  }, [received]);

  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => {
      setShown((p) => {
        const from = Math.max(p, receivedRef.current);
        return from + (CREEP_CEILING - from) * CREEP_RATE;
      });
    }, CREEP_TICK_MS);
    return () => clearInterval(timer);
  }, [isLoading]);

  const progress = finished ? 100 : Math.max(shown, received);

  return (
    <>
      <GuideHeader book={book} stage={stage} locale={locale} dict={dict} progress={gaveUp ? 0 : progress} />

      <p role="status" className="label-mono m-0 px-gutter pt-8 text-concrete">
        {gaveUp
          ? dict.guide.error
          : `${dict.guide.loading} — ${plural(locale, topicCount, dict.guide.loadingTopics)}`}
      </p>
      {gaveUp && (
        <div className="px-gutter pt-4">
          <button
            type="button"
            onClick={retryByHand}
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
