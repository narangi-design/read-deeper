import { Output, streamText } from "ai";
import { getBookById } from "@/lib/books/search";
import { model } from "@/lib/gemini/model";
import type { Locale } from "@/lib/i18n/locales";
import { resolveResources } from "@/lib/resources/resolve";
import type { Book } from "@/lib/schemas/book";
import {
  AFTER_READING_ONLY_SECTIONS,
  generatedGuideSchema,
  MAX_SECTIONS,
  MIN_TOPICS_PER_SECTION,
  type GeneratedGuide,
  type GeneratedTopic,
  type Guide,
  type Stage,
  type Topic,
} from "@/lib/schemas/guide";
import { CONTEXT_GUIDE_SYSTEM_PROMPT, contextGuideUserPrompt } from "@/lib/gemini/prompts";

// At or below this many Open Library editions the model often knows less than it claims.
// A soft signal: well-known books sometimes have a single edition record too.
const MAX_OBSCURE_EDITION_COUNT = 1;

// Enforce the section rules the schema leaves to the prompt. Topics from
// dropped sections move to Further Exploration rather than being lost.
function normalizeSections(guide: GeneratedGuide, stage: Stage): GeneratedGuide {
  if (guide.familiarity === "low") {
    return { ...guide, sections: [], furtherExploration: [] };
  }

  const kept: GeneratedGuide["sections"] = [];
  const displaced: GeneratedTopic[] = [];

  for (const section of guide.sections) {
    const allowed =
      stage === "after" || !AFTER_READING_ONLY_SECTIONS.includes(section.name);
    const fits =
      allowed &&
      kept.length < MAX_SECTIONS &&
      section.topics.length >= MIN_TOPICS_PER_SECTION &&
      !kept.some((other) => other.name === section.name);

    if (fits) {
      kept.push(section);
    } else if (allowed) {
      displaced.push(...section.topics);
    }
  }

  return {
    ...guide,
    sections: kept,
    furtherExploration: [...guide.furtherExploration, ...displaced],
  };
}

async function resolveTopics(guide: GeneratedGuide, locale: Locale) {
  const all = [...guide.sections.flatMap((s) => s.topics), ...guide.furtherExploration];
  const resources = await resolveResources(
    all.map((topic) => topic.startingPoint),
    locale
  );
  const resolved = new Map(all.map((topic, i) => [topic, resources[i]]));

  const toTopic = (topic: GeneratedTopic): Topic => ({
    ...topic,
    startingPoint: { label: topic.startingPoint, ...resolved.get(topic)! },
  });

  return {
    sections: guide.sections.map((s) => ({ name: s.name, topics: s.topics.map(toTopic) })),
    furtherExploration: guide.furtherExploration.map(toTopic),
  };
}

// Streams the model's raw answer; the client renders topics as they arrive
export function streamGeneratedGuide(book: Book, stage: Stage, locale: Locale) {
  return streamText({
    model,
    system: CONTEXT_GUIDE_SYSTEM_PROMPT,
    prompt: contextGuideUserPrompt(book, stage, locale),
    output: Output.object({ schema: generatedGuideSchema }),
  });
}

// Turns the finished model answer into the guide the app stores and renders
export async function finalizeGuide(
  book: Book,
  stage: Stage,
  locale: Locale,
  output: GeneratedGuide
): Promise<Guide> {
  const guide = normalizeSections(output, stage);

  return {
    book,
    stage,
    locale,
    familiar: output.familiarity === "high",
    obscure: book.editionCount <= MAX_OBSCURE_EDITION_COUNT,
    ...(await resolveTopics(guide, locale)),
  };
}

// Back from a finished guide to the model's shape, for clients that asked
// for a stream of a guide someone else generated meanwhile
export function toGeneratedGuide(guide: Guide): GeneratedGuide {
  const toGenerated = (topic: Topic): GeneratedTopic => ({
    ...topic,
    startingPoint: topic.startingPoint.label,
  });

  return {
    familiarity: guide.familiar ? "high" : "low",
    sections: guide.sections.map((s) => ({ name: s.name, topics: s.topics.map(toGenerated) })),
    furtherExploration: guide.furtherExploration.map(toGenerated),
  };
}

// Whole generation without streaming — for scripts and tests
export async function generateContextGuide(
  bookId: string,
  stage: Stage,
  locale: Locale
): Promise<Guide | null> {
  const book = await getBookById(bookId);
  if (!book) return null;

  const result = streamGeneratedGuide(book, stage, locale);
  return finalizeGuide(book, stage, locale, await result.output);
}
