import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";

export const model = google("gemini-3.5-flash");

// Default thinking spends ~24 s before the first token. Minimal and low answer
// in ~4 s but write sloppy Russian ("гумор", broken agreement) and invent
// terms, so medium is the compromise; the title fill covers the wait.
export const providerOptions = {
  google: { thinkingConfig: { thinkingLevel: "medium" } } satisfies GoogleLanguageModelOptions,
};
