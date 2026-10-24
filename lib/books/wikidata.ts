import { LOCALES, type Locale } from "@/lib/i18n/locales";
import type { LocalizedText } from "@/lib/schemas/book";

// Wikidata knows works under their titles in many languages and links them
// to Open Library (property P648). Open Library itself only knows its
// catalogue titles, so "В ожидании Годо" finds nothing there. Wikidata also
// gives the title and the author's name in each UI language.
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
// Wikimedia asks API clients to identify themselves
const USER_AGENT = "ReadDeeper/0.1 (https://github.com/narangi-design/read-deeper)";
const OPEN_LIBRARY_ID = "P648";
// Written works have an author; films with the same title have a director
const AUTHOR = "P50";
const WORK_ID_PATTERN = /^OL\d+W$/;
const SEARCH_LIMIT = 10;
// wbgetentities takes at most 50 ids per request
const MAX_IDS_PER_REQUEST = 50;

interface Entity {
  claims?: Record<string, { mainsnak: { datavalue?: { value: unknown } } }[]>;
  labels?: Record<string, { value: string }>;
}

// A book's title and author name in the UI languages
export interface WorkNames {
  titles: LocalizedText;
  authors: LocalizedText;
}

// A work Open Library has under `workId`, or — when Wikidata lacks the link —
// one to look up there by its English title
export type WikidataWork =
  | ({ workId: string } & WorkNames)
  | ({ workId: null; englishTitle: string } & WorkNames);

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

function authorIdOf(entity: Entity): string | null {
  const value = entity.claims?.[AUTHOR]?.[0]?.mainsnak.datavalue?.value;
  return value && typeof value === "object" && "id" in value ? String(value.id) : null;
}

function labelsOf(entity: Entity | undefined): LocalizedText {
  const labels: LocalizedText = {};
  for (const locale of LOCALES) {
    const label = entity?.labels?.[locale]?.value;
    if (label) labels[locale] = label;
  }
  return labels;
}

async function getEntities(ids: string[], props: string): Promise<Record<string, Entity>> {
  const entities: Record<string, Entity> = {};
  for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
    const data = await queryWikidata<{ entities?: Record<string, Entity> }>({
      action: "wbgetentities",
      ids: ids.slice(i, i + MAX_IDS_PER_REQUEST).join("|"),
      props,
      languages: LOCALES.join("|"),
    });
    Object.assign(entities, data?.entities ?? {});
  }
  return entities;
}

// Titles and author names for work items, authors fetched in one batch
async function namesOf(entities: Entity[]): Promise<WorkNames[]> {
  const authorIds = [...new Set(entities.flatMap((entity) => authorIdOf(entity) ?? []))];
  const authors = await getEntities(authorIds, "labels");
  return entities.map((entity) => {
    const authorId = authorIdOf(entity);
    return { titles: labelsOf(entity), authors: authorId ? labelsOf(authors[authorId]) : {} };
  });
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
  type Candidate = { entity: Entity; workId: string | null; englishTitle?: string };
  const seen = new Set<string>();
  const books = ids.flatMap((id): Candidate[] => {
    const entity = entities[id];
    if (!entity) return [];
    const workId = workIdOf(entity);
    if (workId) {
      if (seen.has(workId)) return [];
      seen.add(workId);
      return [{ entity, workId }];
    }
    const englishTitle = entity.labels?.en?.value;
    return entity.claims?.[AUTHOR] && englishTitle ? [{ entity, workId: null, englishTitle }] : [];
  });

  const names = await namesOf(books.map((book) => book.entity));
  return books.map(({ workId, englishTitle }, i): WikidataWork =>
    workId ? { workId, ...names[i] } : { workId: null, englishTitle: englishTitle!, ...names[i] }
  );
}

// Names for Open Library works Wikidata links to, keyed by work id.
// One search finds all the items: haswbstatement takes `|` as OR.
export async function getWorkNames(workIds: string[]): Promise<Map<string, WorkNames>> {
  const result = new Map<string, WorkNames>();
  if (workIds.length === 0) return result;

  const data = await queryWikidata<{ query?: { search?: { title: string }[] } }>({
    action: "query",
    list: "search",
    srsearch: `haswbstatement:${workIds.map((id) => `${OPEN_LIBRARY_ID}=${id}`).join("|")}`,
    srlimit: String(Math.min(workIds.length * 2, 50)),
    srprop: "",
  });
  const itemIds = data?.query?.search?.map((item) => item.title) ?? [];
  const entities = Object.values(await getEntities(itemIds, "claims|labels"));

  const names = await namesOf(entities);
  entities.forEach((entity, i) => {
    const workId = workIdOf(entity);
    if (workId && workIds.includes(workId) && !result.has(workId)) result.set(workId, names[i]);
  });
  return result;
}
