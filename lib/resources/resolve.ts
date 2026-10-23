import type { Resource } from "@/lib/schemas/resource";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
// Wikimedia asks API clients to identify themselves
const USER_AGENT = "ReadDeeper/0.1 (https://github.com/narangi-design/read-deeper)";
// Share of the label's significant words that must appear in the article title
const MIN_MATCH_SCORE = 0.5;
const STOPWORDS = new Set(["a", "an", "the", "of", "and", "in", "on", "to", "for"]);

type WikipediaOpenSearchResponse = [string, string[], string[], string[]];

interface WikipediaFullTextResponse {
  query?: { search: { title: string }[] };
}

function significantWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !STOPWORDS.has(word));
}

function matchScore(label: string, title: string): number {
  const labelWords = significantWords(label);
  if (labelWords.length === 0) return 0;
  const titleWords = new Set(significantWords(title));
  return labelWords.filter((word) => titleWords.has(word)).length / labelWords.length;
}

function bestMatch(label: string, titles: string[]): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const title of titles) {
    const score = matchScore(label, title);
    if (score > bestScore) {
      best = title;
      bestScore = score;
    }
  }
  return bestScore >= MIN_MATCH_SCORE ? best : null;
}

function wikipediaUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;
}

async function queryWikipedia<T>(params: Record<string, string>): Promise<T | null> {
  const url = new URL(WIKIPEDIA_API);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("format", "json");

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

// Title prefix search — cheap and exact when the label is an article name
async function searchWikipediaTitles(label: string): Promise<string[]> {
  const data = await queryWikipedia<WikipediaOpenSearchResponse>({
    action: "opensearch",
    search: label,
    limit: "5",
    namespace: "0",
    redirects: "resolve",
  });
  return data?.[1] ?? [];
}

// Full-text search — catches labels phrased differently from the article title
async function searchWikipediaFullText(label: string): Promise<string[]> {
  const data = await queryWikipedia<WikipediaFullTextResponse>({
    action: "query",
    list: "search",
    srsearch: label,
    srlimit: "5",
    srprop: "",
    srnamespace: "0",
  });
  return data?.query?.search.map((result) => result.title) ?? [];
}

function britannicaFallback(label: string): Resource {
  return {
    url: `https://www.britannica.com/search?query=${encodeURIComponent(label)}`,
    source: "britannica-search",
    title: label,
  };
}

export async function resolveResource(label: string): Promise<Resource> {
  for (const search of [searchWikipediaTitles, searchWikipediaFullText]) {
    try {
      const title = bestMatch(label, await search(label));
      if (title) return { url: wikipediaUrl(title), source: "wikipedia", title };
    } catch {
      // try the next search, then fall through to Britannica
    }
  }

  return britannicaFallback(label);
}

export async function resolveResources(labels: string[]): Promise<Resource[]> {
  return Promise.all(labels.map(resolveResource));
}
