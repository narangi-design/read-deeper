import { z } from "zod";
import { getBookById } from "@/lib/books/search";
import { streamStored, streamThenStore } from "@/lib/gemini/stream-response";
import {
  finalizeTopicPage,
  streamGeneratedTopicPage,
  toGeneratedTopicPage,
} from "@/lib/gemini/topic-page";
import { localeSchema } from "@/lib/i18n/locales";
import { stageSchema } from "@/lib/schemas/guide";
import { topicPathSchema } from "@/lib/schemas/topic";
import { getStoredTopicPage, saveTopicPage } from "@/lib/storage/generated";

// Generation plus link resolution takes ~10 s; leave room for retries
export const maxDuration = 60;

const requestSchema = z.object({
  bookId: z.string(),
  stage: stageSchema,
  locale: localeSchema,
  path: topicPathSchema,
});

// Streams a topic page being generated, for the topic page's client component.
// Not a public API: the page renders stored topic pages itself.
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { bookId, stage, locale, path } = parsed.data;

  const stored = await getStoredTopicPage(bookId, stage, locale, path);
  if (stored) return streamStored(toGeneratedTopicPage(stored));

  const book = await getBookById(bookId);
  if (!book) {
    return Response.json({ error: "Book not found" }, { status: 404 });
  }

  const result = streamGeneratedTopicPage(book, stage, locale, path);
  return streamThenStore(result.textStream, async () => {
    await saveTopicPage(await finalizeTopicPage(book, stage, locale, path, await result.output));
  });
}
