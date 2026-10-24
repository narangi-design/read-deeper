import { z } from "zod";
import { localeSchema, type Locale } from "@/lib/i18n/locales";

// Text in the UI languages, from Wikidata
export const localizedTextSchema = z.partialRecord(localeSchema, z.string());

export const bookSchema = z.object({
  id: z.string(),
  // Open Library's catalogue title and author, often in the original
  // language ("En attendant Godot", "Samuel Beckett")
  title: z.string(),
  author: z.string(),
  titles: localizedTextSchema.default({}),
  authors: localizedTextSchema.default({}),
  year: z.number().nullable(),
  coverUrl: z.string().nullable(),
  editionCount: z.number(),
});

export type Book = z.infer<typeof bookSchema>;
export type LocalizedText = z.infer<typeof localizedTextSchema>;

// Title and author to show: in the UI language when known, else the catalogue ones
export function displayTitle(book: Book, locale: Locale): string {
  return book.titles[locale] ?? book.title;
}

export function displayAuthor(book: Book, locale: Locale): string {
  return book.authors[locale] ?? book.author;
}
