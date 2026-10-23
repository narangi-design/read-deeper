import { generateText, Output } from "ai";
import { cacheLife } from "next/cache";
import { getBookById } from "@/lib/books/search";
import { model } from "@/lib/gemini/model";
import { TOPIC_PAGE_SYSTEM_PROMPT, topicPageUserPrompt } from "@/lib/gemini/prompts";
import type { Locale } from "@/lib/i18n/locales";
import { resolveResources } from "@/lib/resources/resolve";
import type { Stage } from "@/lib/schemas/guide";
import {
  generatedTopicPageSchema,
  MAX_RELATED_TOPICS,
  MAX_RESOURCES,
  type RelatedTopic,
  type TopicPage,
} from "@/lib/schemas/topic";

function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// The prompt asks for this too, but loop prevention can't rely on the model
function dropExploredTopics(topics: RelatedTopic[], path: string[]): RelatedTopic[] {
  const seen = new Set(path.map(normalizeTitle));
  return topics.filter((topic) => {
    const key = normalizeTitle(topic.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Uncached generation — use getTopicPage in the app
export async function generateTopicPage(
  bookId: string,
  stage: Stage,
  locale: Locale,
  path: string[]
): Promise<TopicPage | null> {
  const book = await getBookById(bookId);
  if (!book) return null;

  const { output } = await generateText({
    model,
    system: TOPIC_PAGE_SYSTEM_PROMPT,
    prompt: topicPageUserPrompt(book, stage, locale, path),
    output: Output.object({ schema: generatedTopicPageSchema }),
  });

  const labels = output.resources.slice(0, MAX_RESOURCES);
  const resolved = (await resolveResources(labels, locale)).map((resource, i) => ({
    ...resource,
    label: labels[i],
  }));
  // A Britannica search is a guess — show one only when nothing better was found
  const found = resolved.filter((resource) => resource.source === "wikipedia");
  const resources = found.length > 0 ? found : resolved.slice(0, 1);

  return {
    book,
    stage,
    locale,
    path,
    whyItMatters: output.whyItMatters,
    resources,
    relatedTopics: dropExploredTopics(output.relatedTopics, path).slice(0, MAX_RELATED_TOPICS),
  };
}

// Returns null when the book doesn't exist. path comes from the URL and
// must be validated with topicPathSchema first.
export async function getTopicPage(
  bookId: string,
  stage: Stage,
  locale: Locale,
  path: string[]
): Promise<TopicPage | null> {
  "use cache: remote";
  cacheLife("max");

  return generateTopicPage(bookId, stage, locale, path);
}
