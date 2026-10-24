import { NextRequest } from "next/server";
import { searchBooks } from "@/lib/books/search";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  const langParam = request.nextUrl.searchParams.get("lang") ?? "";
  const lang = isLocale(langParam) ? langParam : DEFAULT_LOCALE;

  if (!query) {
    return Response.json(
      { error: 'Missing query parameter "q"' },
      { status: 400 }
    );
  }

  try {
    const books = await searchBooks(query, lang);
    return Response.json({ books });
  } catch {
    return Response.json(
      { error: "Failed to search books" },
      { status: 502 }
    );
  }
}
