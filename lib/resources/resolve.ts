type WikipediaOpenSearchResponse = [string, string[], string[], string[]];

async function resolveViaWikipedia(label: string): Promise<string | null> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "opensearch");
  url.searchParams.set("search", label);
  url.searchParams.set("limit", "1");
  url.searchParams.set("namespace", "0");
  url.searchParams.set("format", "json");

  const res = await fetch(url);
  if (!res.ok) return null;

  const [, , , urls] = (await res.json()) as WikipediaOpenSearchResponse;
  return urls[0] ?? null;
}

function britannicaFallback(label: string): string {
  return `https://www.britannica.com/search?query=${encodeURIComponent(label)}`;
}

export async function resolveResource(label: string): Promise<string> {
  try {
    const wikipediaUrl = await resolveViaWikipedia(label);
    if (wikipediaUrl) return wikipediaUrl;
  } catch {
    // fall through to Britannica fallback
  }

  return britannicaFallback(label);
}

export async function resolveResources(labels: string[]): Promise<string[]> {
  return Promise.all(labels.map(resolveResource));
}
