# Read Deeper — Backlog

Ordered top to bottom so that each task only depends on tasks above it.
"Depends on" is listed explicitly where it's not just "the task above".

## Setup

- [x] Init Next.js project (App Router, TypeScript, Tailwind) via `create-next-app`
- [x] Install deps: Vercel AI SDK, `@ai-sdk/google`, `zod`
- [x] Set up `.env.local` with Gemini API key, add `.env.example`
- [x] Basic project structure: `app/`, `lib/`, `components/`
- [x] Deploy empty skeleton to Vercel — confirms the pipeline (env vars, build) works before real code depends on it

## Backend

- [x] Book search API route — wraps Open Library, returns candidate list (title, author, year, cover), normalized to canonical Book shape inline (merged with the mapping task below — separating them was unneeded abstraction for a 4-field map)
  _Depends on: Setup deploy skeleton_
- [x] ~~Canonical book object mapping~~ — done as part of the search route above
- [x] Resource resolver function — label → URL (Wikipedia opensearch, fallback Britannica search link)
  _Depends on: Setup_ — no dependency on the other backend tasks, can be built in parallel with them
- [x] Resolver returns `{ url, source, title, lang }`: exact English Wikipedia title (redirects followed, disambiguation skipped, one batched request) → full-text search with a similarity check → Britannica search link. Links to the UI locale's article via langlinks when one exists
- [x] `getBookById` — book lookup by Open Library work id, for `/book/[id]` URLs (book is never carried in client state or query params)
- [x] Context Guide — `lib/gemini/context-guide.ts`. Prompt 1 ([prompts.md](prompts.md)) with a 20-section dictionary (3 picked, after-reading-only sections excluded for "before"), flat Further Exploration, answers in the UI language. Familiarity check: model self-assessment (empty guide when low) + soft `obscure` flag for books with a single Open Library edition
  _Depends on: Canonical book object, Resource resolver_
- [x] Topic Page — `lib/gemini/topic-page.ts`, same pattern as Context Guide. Input is the exploration path from the URL (current topic last) instead of the guide's `whyItMatters`, so topic links are shareable and don't depend on the guide being cached. Takes the reading stage (no spoilers before reading). Resolves `resources[]`, drops Britannica fallbacks unless nothing else was found, drops related topics that repeat the path, suggests only topics from outside the book
  _Depends on: Resource resolver, Context Guide_
- [x] Streaming + storage — guides and topic pages are stored in Upstash Redis without expiry (`lib/storage/generated.ts`, key carries `STORAGE_VERSION`), so a shared link always opens what the sender saw. Pages render stored results directly; on a miss the client streams `POST /api/guide` / `POST /api/topic` (internal, not a public API) with `useObject` and shows topics as they arrive. The route resolves links and stores the result before closing the stream, so a refresh at stream end renders the finished page; generation finishes via `after()` even if the client leaves. Replaced `'use cache: remote'` (it can't cache a stream); `cacheComponents` is off
  _Depends on: Context Guide, Topic Page_
- [ ] Rate-limit `/api/guide` and `/api/topic` per IP (`@upstash/ratelimit` on the same Redis) — the routes are reachable by anyone and each miss costs a Gemini request
  _Depends on: Streaming + storage_
- [ ] Two readers opening the same uncached guide at once generate it twice — add a short Redis lock if it shows up in practice
  _Depends on: Streaming + storage_

## Frontend

- [ ] Shared layout + minimal design system (typography, spacing, loading/error states)
  _Depends on: Setup_
- [ ] i18n routing — `en`/`ru` locale prefix in URLs (`app/[lang]`), default picked from browser language, switcher in the header. UI strings and section names translated via dictionaries (the model always returns English section keys). The locale in the URL keeps shared guide links in the sender's language
  _Depends on: Shared layout_
- [ ] Decide how to show book titles: Open Library returns the original-language title ("Мастер и Маргарита", "Księgi Jakubowe") even for English searches, and sometimes a messy one ("Bel Kaufman's up the down stair case")
  _Depends on: Step 2_
- [ ] Search by translated titles — Open Library can't find "Вверх по лестнице, ведущей вниз". Proposal: search Wikidata (multilingual labels + Open Library work id, P648), fall back to Open Library search; Wikidata's label in the UI locale also answers the title question above
  _Depends on: Step 1_
- [ ] Guide loading — title fill reflects real progress: ~10% creep while the model thinks, then topics received / expected, full when the stream closes
  _Depends on: Streaming + storage, Step 4_
- [ ] Step 1 — Home/search page
  _Depends on: Book search API route_
- [ ] Step 2 — Confirm book page
  _Depends on: Book search API route (result shape), Shared layout_
- [ ] Step 3 — Reading stage selection
  _Depends on: Step 2 (needs confirmed book carried forward in route/state)_
- [ ] Step 4 — Context Guide results page (sections + Further Exploration)
  _Depends on: Context Guide, Step 3_
- [ ] Steps 5–6 — Topic page incl. rabbit-hole navigation (breadcrumb, related topics)
  _Depends on: Topic Page, Step 4_

## Integration & Polish

- [ ] Gemini free-tier quota — 7 parallel guide generations already hit it; needs a paid tier or rate limiting before real traffic
- [ ] Handle malformed/empty AI output gracefully (retry once, then friendly error state)
  _Depends on: Context Guide, Topic Page_
- [ ] Handle no search results / book not found state
  _Depends on: Step 1_
- [ ] Handle breadcrumb loop prevention end-to-end (don't suggest already-explored topics) — backend half done: Topic Page filters out topics from the path. Remaining: check it in the UI
  _Depends on: Steps 5–6_

## QA & Ship

- [ ] Manual end-to-end pass through full user flow (search → confirm → stage → guide → topic → explore)
  _Depends on: everything above_
- [ ] Deploy final build to Vercel
  _Depends on: QA pass_
- [ ] Portfolio write-up / README (problem, approach, stack, screenshots)
  _Depends on: Deploy_

## Explicitly out of scope for MVP

- Knowledge graph visualization
- Auth
- Save/bookmark/favorites
- Reading history
- Book recommendations
- Chat interface
- Quote search
- Goodreads import
- Notes
- AI-generated summaries
- Video resources
