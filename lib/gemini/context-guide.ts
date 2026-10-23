import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { cacheLife } from "next/cache";
import { getBookById } from "@/lib/books/search";
import type { Locale } from "@/lib/i18n/locales";
import { resolveResources } from "@/lib/resources/resolve";
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

const MODEL = "gemini-3.5-flash";
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

// Uncached generation — use getContextGuide in the app
export async function generateContextGuide(
  bookId: string,
  stage: Stage,
  locale: Locale
): Promise<Guide | null> {
  const book = await getBookById(bookId);
  if (!book) return null;

  const { output } = await generateText({
    model: google(MODEL),
    system: CONTEXT_GUIDE_SYSTEM_PROMPT,
    prompt: contextGuideUserPrompt(book, stage, locale),
    output: Output.object({ schema: generatedGuideSchema }),
  });

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

// Returns null when the book doesn't exist. Cached remotely so a guide
// link opens instantly and doesn't cost another model call.
export async function getContextGuide(
  bookId: string,
  stage: Stage,
  locale: Locale
): Promise<Guide | null> {
  "use cache: remote";
  cacheLife("max");

  return generateContextGuide(bookId, stage, locale);
}
