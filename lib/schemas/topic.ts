import { z } from "zod";
import { localeSchema } from "@/lib/i18n/locales";
import { bookSchema } from "@/lib/schemas/book";
import { stageSchema } from "@/lib/schemas/guide";
import { resourceSchema } from "@/lib/schemas/resource";

export const MAX_RESOURCES = 3;
export const MIN_RELATED_TOPICS = 3;
export const MAX_RELATED_TOPICS = 5;
// Caps the URL and the prompt; deeper rabbit holes start over from the guide
export const MAX_PATH_LENGTH = 10;

// The topics explored so far, current one last. Comes from the URL.
export const topicPathSchema = z
  .array(z.string().trim().min(1).max(200))
  .min(1)
  .max(MAX_PATH_LENGTH);

const relatedTopicSchema = z.object({
  title: z.string(),
  reason: z.string(),
});

// What Gemini returns. Counts are enforced after generation.
export const generatedTopicPageSchema = z.object({
  whyItMatters: z.string(),
  resources: z.array(z.string()),
  relatedTopics: z.array(relatedTopicSchema),
});

export type GeneratedTopicPage = z.infer<typeof generatedTopicPageSchema>;

export const topicPageSchema = z.object({
  book: bookSchema,
  stage: stageSchema,
  locale: localeSchema,
  path: topicPathSchema,
  whyItMatters: z.string(),
  // label keeps the model's English search key, for debugging
  resources: z.array(resourceSchema.extend({ label: z.string() })),
  relatedTopics: z.array(relatedTopicSchema),
});

export type TopicPage = z.infer<typeof topicPageSchema>;
export type RelatedTopic = z.infer<typeof relatedTopicSchema>;
