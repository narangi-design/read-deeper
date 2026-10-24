import { LOCALES, type Locale } from "@/lib/i18n/locales";
import type { BookTitles } from "@/lib/schemas/book";

// Wikidata knows works under their titles in many languages and links them
// to Open Library (property P648). Open Library itself only knows its
// catalogue titles, so "В ожидании Годо" finds nothing there.
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
// Wikimedia asks API clients to identify themselves
const USER_AGENT = "ReadDeeper/0.1 (https://github.com/narangi-design/read-deeper)";
const OPEN_LIBRARY_ID = "P648";
// Written works have an author; films with the same title have a director
const AUTHOR = "P50";
const WORK_ID_PATTERN = /^OL\d+W$/;
const SEARCH_LIMIT = 10;

interface Entity {
  claims?: Record<string, { mainsnak: { datavalue?: { value: unknown } } }[]>;
  labels?: Record<string, { value: string }>;
}

// A work Open Library has under `workId`, or — when Wikidata lacks the link —
// one to look up there by its English title
export type WikidataWork =
  | { workId: string; titles: BookTitles }
  | { workId: null; englishTitle: string; titles: BookTitles };

async function queryWikidata<T>(params: Record<string, string>): Promise<T | null> {
  const url = new URL(WIKIDATA_API);
  for (const [key, value] of Object.entries({ format: "json", ...params })) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

// Edition (…M) and author (…A) ids share the property; only works count
function workIdOf(entity: Entity): string | null {
  for (const claim of entity.claims?.[OPEN_LIBRARY_ID] ?? []) {
    const value = claim.mainsnak.datavalue?.value;
    if (typeof value === "string" && WORK_ID_PATTERN.test(value)) return value;
  }
  return null;
}

function titlesOf(entity: Entity): BookTitles {
  const titles: BookTitles = {};
  for (const locale of LOCALES) {
    const label = entity.labels?.[locale]?.value;
    if (label) titles[locale] = label;
  }
  return titles;
}

async function getEntities(ids: string[], props: string): Promise<Record<string, Entity>> {
  if (ids.length === 0) return {};
  const data = await queryWikidata<{ entities?: Record<string, Entity> }>({
    action: "wbgetentities",
    ids: ids.join("|"),
    props,
    languages: LOCALES.join("|"),
  });
  return data?.entities ?? {};
}

async function searchItemIds(query: string, language: Locale): Promise<string[]> {
  const data = await queryWikidata<{ search?: { id: string }[] }>({
    action: "wbsearchentities",
    search: query,
    language,
    uselang: language,
    type: "item",
    limit: String(SEARCH_LIMIT),
  });
  return data?.search?.map((item) => item.id) ?? [];
}

// Works matching a title in any supported language, the UI language first.
// Items that are neither linked to Open Library nor written by someone
// (films, planets, people) drop out.
export async function findWorksByTitle(query: string, locale: Locale): Promise<WikidataWork[]> {
  const languages = [locale, ...LOCALES.filter((other) => other !== locale)];
  const found = await Promise.all(languages.map((language) => searchItemIds(query, language)));
  const ids = [...new Set(found.flat())];

  const entities = await getEntities(ids, "claims|labels");
  const works: WikidataWork[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const entity = entities[id];
    if (!entity) continue;
    const titles = titlesOf(entity);
    const workId = workIdOf(entity);

    if (workId && !seen.has(workId)) {
      seen.add(workId);
      works.push({ workId, titles });
    } else if (!workId && entity.claims?.[AUTHOR] && titles.en) {
      works.push({ workId: null, englishTitle: titles.en, titles });
    }
  }
  return works;
}

// Titles of an Open Library work in the supported languages, if Wikidata has it
export async function getWorkTitles(workId: string): Promise<BookTitles> {
  const data = await queryWikidata<{ query?: { search?: { title: string }[] } }>({
    action: "query",
    list: "search",
    srsearch: `haswbstatement:${OPEN_LIBRARY_ID}=${workId}`,
    srlimit: "1",
  });
  const itemId = data?.query?.search?.[0]?.title;
  if (!itemId) return {};

  const entity = (await getEntities([itemId], "labels"))[itemId];
  return entity ? titlesOf(entity) : {};
}
