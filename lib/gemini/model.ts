import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";

export const model = google("gemini-3.5-flash");

// Default thinking spends ~24 s before the first token; minimal answers in
// ~4 s with close quality, so streamed topics actually arrive progressively
export const providerOptions = {
  google: { thinkingConfig: { thinkingLevel: "minimal" } } satisfies GoogleLanguageModelOptions,
};
