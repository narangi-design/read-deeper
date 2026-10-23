import { z } from "zod";
import { localeSchema } from "@/lib/i18n/locales";

export const resourceSchema = z.object({
  url: z.string(),
  source: z.enum(["wikipedia", "britannica-search"]),
  title: z.string(),
  // Language of the linked page — differs from the UI locale when no translation exists
  lang: localeSchema,
});

export type Resource = z.infer<typeof resourceSchema>;
