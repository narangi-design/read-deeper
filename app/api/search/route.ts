import { NextRequest } from "next/server";
import { searchBooks } from "@/lib/books/search";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return Response.json(
      { error: 'Missing query parameter "q"' },
      { status: 400 }
    );
  }

  try {
    const books = await searchBooks(query);
    return Response.json({ books });
  } catch {
    return Response.json(
      { error: "Failed to search books" },
      { status: 502 }
    );
  }
}
