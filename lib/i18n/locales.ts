import { z } from "zod";

export const LOCALES = ["en", "ru"] as const;
export const DEFAULT_LOCALE = "en";

export const localeSchema = z.enum(LOCALES);

export type Locale = z.infer<typeof localeSchema>;

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

// How each locale is named in prompts to the model
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  ru: "Russian",
};
