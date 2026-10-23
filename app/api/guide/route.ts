import { z } from "zod";
import { getBookById } from "@/lib/books/search";
import {
  finalizeGuide,
  streamGeneratedGuide,
  toGeneratedGuide,
} from "@/lib/gemini/context-guide";
import { streamStored, streamThenStore } from "@/lib/gemini/stream-response";
import { localeSchema } from "@/lib/i18n/locales";
import { stageSchema } from "@/lib/schemas/guide";
import { getStoredGuide, saveGuide } from "@/lib/storage/generated";

// Generation plus link resolution takes ~20 s; leave room for retries
export const maxDuration = 60;

const requestSchema = z.object({
  bookId: z.string(),
  stage: stageSchema,
  locale: localeSchema,
});

// Streams a guide being generated, for the guide page's client component.
// Not a public API: the page renders stored guides itself.
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { bookId, stage, locale } = parsed.data;

  const stored = await getStoredGuide(bookId, stage, locale);
  if (stored) return streamStored(toGeneratedGuide(stored));

  const book = await getBookById(bookId);
  if (!book) {
    return Response.json({ error: "Book not found" }, { status: 404 });
  }

  const result = streamGeneratedGuide(book, stage, locale);
  return streamThenStore(result.textStream, async () => {
    await saveGuide(await finalizeGuide(book, stage, locale, await result.output));
  });
}
