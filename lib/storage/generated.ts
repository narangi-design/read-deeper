import { createHash } from "node:crypto";
import type { Locale } from "@/lib/i18n/locales";
import { guideSchema, type Guide, type Stage } from "@/lib/schemas/guide";
import { topicPageSchema, type TopicPage } from "@/lib/schemas/topic";
import { redis } from "@/lib/storage/redis";

// Generated guides and topic pages are stored without expiry, so a shared
// link always opens what the sender saw. Bump this when a prompt or a stored
// shape changes: links then regenerate instead of mixing old and new output.
const STORAGE_VERSION = 1;

function guideKey(bookId: string, stage: Stage, locale: Locale): string {
  return `guide:v${STORAGE_VERSION}:${bookId}:${stage}:${locale}`;
}

// The path can be long and hold any characters, so it's hashed
function topicKey(bookId: string, stage: Stage, locale: Locale, path: string[]): string {
  const pathHash = createHash("sha256").update(JSON.stringify(path)).digest("hex");
  return `topic:v${STORAGE_VERSION}:${bookId}:${stage}:${locale}:${pathHash}`;
}

export async function getStoredGuide(
  bookId: string,
  stage: Stage,
  locale: Locale
): Promise<Guide | null> {
  const parsed = guideSchema.safeParse(await redis.get(guideKey(bookId, stage, locale)));
  return parsed.success ? parsed.data : null;
}

export async function saveGuide(guide: Guide): Promise<void> {
  await redis.set(guideKey(guide.book.id, guide.stage, guide.locale), guide);
}

export async function getStoredTopicPage(
  bookId: string,
  stage: Stage,
  locale: Locale,
  path: string[]
): Promise<TopicPage | null> {
  const parsed = topicPageSchema.safeParse(
    await redis.get(topicKey(bookId, stage, locale, path))
  );
  return parsed.success ? parsed.data : null;
}

export async function saveTopicPage(page: TopicPage): Promise<void> {
  await redis.set(topicKey(page.book.id, page.stage, page.locale, page.path), page);
}
