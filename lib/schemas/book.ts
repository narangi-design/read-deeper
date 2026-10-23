import { z } from "zod";

export const bookSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  year: z.number().nullable(),
  coverUrl: z.string().nullable(),
  editionCount: z.number(),
});

export type Book = z.infer<typeof bookSchema>;
