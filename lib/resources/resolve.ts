import type { Locale } from "@/lib/i18n/locales";
import type { Resource } from "@/lib/schemas/resource";

// Labels are English search keys: English Wikipedia has the widest coverage,
// and langlinks lead from its articles to the UI locale's version.
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
// Wikimedia asks API clients to identify themselves
const USER_AGENT = "ReadDeeper/0.1 (https://github.com/narangi-design/read-deeper)";
// Dice similarity between label and article title words
const MIN_MATCH_SCORE = 0.6;
// Shorter words must match exactly — "art" shouldn't match "artemis"
const MIN_PREFIX_MATCH_LENGTH = 4;
const STOPWORDS = new Set(["a", "an", "the", "of", "and", "in", "on", "to", "for"]);
// Wikipedia rate-limits bursts: exact lookups go out in one batched request,
// full-text searches a few at a time
const MAX_TITLES_PER_REQUEST = 50;
const MAX_CONCURRENT_SEARCHES = 3;

interface WikipediaPage {
  title: string;
  missing?: boolean;
  index?: number;
  pageprops?: { disambiguation?: string };
  langlinks?: { lang: string; title: string }[];
}

interface WikipediaQueryResponse {
  query?: {
    pages?: WikipediaPage[];
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string; tofragment?: string }[];
  };
}

interface Match {
  page: WikipediaPage;
  // Section of the target article when the label is a redirect to it
  fragment?: string;
}

// Parenthetical qualifiers ("John Butler (Ranger)") are ignored when comparing
function significantWords(text: string): string[] {
  return text
    .replace(/\s*\([^)]*\)/g, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !STOPWORDS.has(word));
}

function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < MIN_PREFIX_MATCH_LENGTH) return false;
  return a.startsWith(b) || b.startsWith(a);
}

function matchScore(label: string, title: string): number {
  const labelWords = significantWords(label);
  const titleWords = significantWords(title);
  if (labelWords.length === 0 || titleWords.length === 0) return 0;

  const common = labelWords.filter((word) =>
    titleWords.some((other) => wordsMatch(word, other))
  ).length;
  return (2 * common) / (labelWords.length + titleWords.length);
}

function isArticle(page: WikipediaPage): boolean {
  return !page.missing && page.pageprops?.disambiguation === undefined;
}

function wikipediaUrl(lang: Locale, title: string, fragment?: string): string {
  const encode = (text: string) => encodeURIComponent(text.replaceAll(" ", "_"));
  const hash = fragment ? `#${encode(fragment)}` : "";
  return `https://${lang}.wikipedia.org/wiki/${encode(title)}${hash}`;
}

async function queryWikipedia(
  params: Record<string, string>,
  locale: Locale
): Promise<WikipediaQueryResponse | null> {
  const url = new URL(WIKIPEDIA_API);
  const allParams: Record<string, string> = {
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "pageprops|langlinks",
    ppprop: "disambiguation",
    ...(locale !== "en" && { lllang: locale, lllimit: "max" }),
    ...params,
  };
  for (const [key, value] of Object.entries(allParams)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  return (await res.json()) as WikipediaQueryResponse;
}

// Labels that are article titles or redirects to one. Redirects are
// curated by editors, so they're trusted without a word match.
async function findExactArticles(labels: string[], locale: Locale): Promise<Map<string, Match>> {
  const matches = new Map<string, Match>();
  // "|" separates titles in the API, so such labels can only be searched
  const titles = labels.filter((label) => !label.includes("|"));

  for (let i = 0; i < titles.length; i += MAX_TITLES_PER_REQUEST) {
    const batch = titles.slice(i, i + MAX_TITLES_PER_REQUEST);
    const data = await queryWikipedia({ titles: batch.join("|") }, locale);
    const query = data?.query;
    if (!query) continue;

    for (const label of batch) {
      const normalized = query.normalized?.find((n) => n.from === label)?.to ?? label;
      const redirect = query.redirects?.find((r) => r.from === normalized);
      const page = query.pages?.find((p) => p.title === (redirect?.to ?? normalized));
      if (page && isArticle(page)) {
        matches.set(label, { page, fragment: redirect?.tofragment });
      }
    }
  }
  return matches;
}

// Full-text search — catches labels phrased differently from the article title
async function searchArticle(label: string, locale: Locale): Promise<Match | null> {
  const data = await queryWikipedia(
    { generator: "search", gsrsearch: label, gsrlimit: "5", gsrnamespace: "0" },
    locale
  );
  const pages = (data?.query?.pages ?? [])
    .filter(isArticle)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  let best: WikipediaPage | null = null;
  let bestScore = 0;
  for (const page of pages) {
    const score = matchScore(label, page.title);
    if (score > bestScore) {
      best = page;
      bestScore = score;
    }
  }
  return best && bestScore >= MIN_MATCH_SCORE ? { page: best } : null;
}

function toResource({ page, fragment }: Match, locale: Locale): Resource {
  const translation = page.langlinks?.find((link) => link.lang === locale);
  if (locale !== "en" && translation) {
    return {
      url: wikipediaUrl(locale, translation.title),
      source: "wikipedia",
      title: translation.title,
      lang: locale,
    };
  }

  return {
    url: wikipediaUrl("en", page.title, fragment),
    source: "wikipedia",
    title: page.title,
    lang: "en",
  };
}

function britannicaFallback(label: string): Resource {
  return {
    url: `https://www.britannica.com/search?query=${encodeURIComponent(label)}`,
    source: "britannica-search",
    title: label,
    lang: "en",
  };
}

async function searchArticles(labels: string[], locale: Locale): Promise<Map<string, Match>> {
  const matches = new Map<string, Match>();
  const queue = [...labels];

  const worker = async () => {
    for (let label = queue.shift(); label !== undefined; label = queue.shift()) {
      try {
        const match = await searchArticle(label, locale);
        if (match) matches.set(label, match);
      } catch {
        // leave unmatched — falls through to Britannica
      }
    }
  };
  await Promise.all(Array.from({ length: MAX_CONCURRENT_SEARCHES }, worker));
  return matches;
}

export async function resolveResources(labels: string[], locale: Locale): Promise<Resource[]> {
  const unique = [...new Set(labels)];

  let matches = new Map<string, Match>();
  try {
    matches = await findExactArticles(unique, locale);
  } catch {
    // fall through to full-text search for every label
  }

  const unmatched = unique.filter((label) => !matches.has(label));
  for (const [label, match] of await searchArticles(unmatched, locale)) {
    matches.set(label, match);
  }

  return labels.map((label) => {
    const match = matches.get(label);
    return match ? toResource(match, locale) : britannicaFallback(label);
  });
}

export async function resolveResource(label: string, locale: Locale): Promise<Resource> {
  const [resource] = await resolveResources([label], locale);
  return resource;
}
