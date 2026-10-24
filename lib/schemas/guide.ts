import { z } from "zod";
import { localeSchema } from "@/lib/i18n/locales";
import { bookSchema } from "@/lib/schemas/book";
import { resourceSchema } from "@/lib/schemas/resource";

export const SECTIONS = [
  "Literary Influences",
  "Genre & Form",
  "Author's Life",
  "Historical Events",
  "Politics & Power",
  "Society & Class",
  "Culture & Customs",
  "Religion & Mythology",
  "Philosophy",
  "Science & Technology",
  "Psychology",
  "Art & Music",
  "Language & Style",
  "Places & Geography",
  "Economics & Work",
  "Gender & Family",
  "Law & Justice",
  "War & Conflict",
  "Symbols & Allusions",
  "Reception & Legacy",
] as const;

// These sections can't be written without revealing the plot
export const AFTER_READING_ONLY_SECTIONS: readonly Section[] = [
  "Symbols & Allusions",
  "Reception & Legacy",
];

export const MAX_SECTIONS = 3;
export const MIN_TOPICS_PER_SECTION = 2;

export const stageSchema = z.enum(["before", "after"]);
export const STAGES = stageSchema.options;

export type Section = (typeof SECTIONS)[number];
export type Stage = z.infer<typeof stageSchema>;

// What Gemini returns. Kept lenient: section count and size are enforced
// after generation, so a slightly off answer is trimmed instead of rejected.
const generatedTopicSchema = z.object({
  title: z.string(),
  whyItMatters: z.string(),
  startingPoint: z.string(),
});

export const generatedGuideSchema = z.object({
  familiarity: z.enum(["high", "low"]),
  sections: z.array(
    z.object({
      name: z.enum(SECTIONS),
      topics: z.array(generatedTopicSchema),
    })
  ),
  furtherExploration: z.array(generatedTopicSchema),
});

export type GeneratedGuide = z.infer<typeof generatedGuideSchema>;
export type GeneratedTopic = z.infer<typeof generatedTopicSchema>;

// What the app renders: starting points resolved to real links.
// label keeps the model's English search key, for debugging.
export const topicSchema = generatedTopicSchema.extend({
  startingPoint: resourceSchema.extend({ label: z.string() }),
});

export const guideSchema = z.object({
  book: bookSchema,
  stage: stageSchema,
  locale: localeSchema,
  // The model admitted it doesn't know the book well — sections are empty
  familiar: z.boolean(),
  // A single edition on Open Library — the model may know less than it claims
  obscure: z.boolean(),
  sections: z.array(
    z.object({
      name: z.enum(SECTIONS),
      topics: z.array(topicSchema),
    })
  ),
  furtherExploration: z.array(topicSchema),
});

export type Topic = z.infer<typeof topicSchema>;
export type Guide = z.infer<typeof guideSchema>;
