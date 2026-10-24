import { z } from "zod";
import { localeSchema, type Locale } from "@/lib/i18n/locales";

// Titles in the UI languages, from Wikidata — Open Library's `title` is its
// catalogue title, often the original ("En attendant Godot")
export const bookTitlesSchema = z.partialRecord(localeSchema, z.string());

export const bookSchema = z.object({
  id: z.string(),
  title: z.string(),
  titles: bookTitlesSchema.default({}),
  author: z.string(),
  year: z.number().nullable(),
  coverUrl: z.string().nullable(),
  editionCount: z.number(),
});

export type Book = z.infer<typeof bookSchema>;
export type BookTitles = z.infer<typeof bookTitlesSchema>;

// The title to show: in the UI language when known, else the catalogue one
export function displayTitle(book: Book, locale: Locale): string {
  return book.titles[locale] ?? book.title;
}
