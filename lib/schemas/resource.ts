import { z } from "zod";

export const resourceSchema = z.object({
  url: z.string(),
  source: z.enum(["wikipedia", "britannica-search"]),
  title: z.string(),
});

export type Resource = z.infer<typeof resourceSchema>;
