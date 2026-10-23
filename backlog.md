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
- [ ] Context Guide API route — calls Gemini with prompt 1 ([prompts.md](prompts.md)), validates output against zod schema, resolves `startingPoint` via resource resolver
  _Depends on: Canonical book object, Resource resolver_
- [ ] Topic Page API route — calls Gemini with prompt 2, validates output against zod schema, resolves `resources[]` via resource resolver
  _Depends on: Resource resolver, Context Guide API route (consumes its `whyItMatters`/topic shape as input)_

## Frontend

- [ ] Shared layout + minimal design system (typography, spacing, loading/error states)
  _Depends on: Setup_
- [ ] Step 1 — Home/search page
  _Depends on: Book search API route_
- [ ] Step 2 — Confirm book page
  _Depends on: Book search API route (result shape), Shared layout_
- [ ] Step 3 — Reading stage selection
  _Depends on: Step 2 (needs confirmed book carried forward in route/state)_
- [ ] Step 4 — Context Guide results page (sections + Further Exploration)
  _Depends on: Context Guide API route, Step 3_
- [ ] Steps 5–6 — Topic page incl. rabbit-hole navigation (breadcrumb, related topics)
  _Depends on: Topic Page API route, Step 4_

## Integration & Polish

- [ ] Handle malformed/empty AI output gracefully (retry once, then friendly error state)
  _Depends on: Context Guide API route, Topic Page API route_
- [ ] Handle no search results / book not found state
  _Depends on: Step 1_
- [ ] Handle breadcrumb loop prevention end-to-end (don't suggest already-explored topics)
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
