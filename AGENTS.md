# CarouselBrain — Project Memory for Codex

## What this project is

CarouselBrain is a full-stack web application that extracts structured, actionable knowledge from educational Instagram carousel screenshots. Users upload 1–10 carousel images → OCR extracts the text → an LLM structures it → the user gets a clean knowledge page.

The core pipeline is: **image upload → OCR.space → Groq LLM → structured JSON → rendered output page.**

This is an MVP for a solo founder. Every decision prioritizes working software, near-zero infrastructure cost, and fast iteration. Do not over-engineer.

---

## Tech stack — never deviate from this

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 14 App Router | Full-stack in one repo |
| Language | TypeScript strict mode | `strict: true` in tsconfig |
| Styling | Tailwind CSS v3 | No CSS modules, no styled-components |
| Auth | Supabase Auth (magic link) | No password auth |
| Database | Supabase PostgreSQL | Row-level security always on |
| File storage | Supabase Storage | Private bucket: `carousel-images` |
| OCR | OCR.space REST API | Engine 2, no SDK, raw fetch only |
| LLM | Groq API, model: `llama-3.3-70b-versatile` | JSON mode via `response_format: {type: 'json_object'}` |
| Deployment | Vercel | Free tier |

**Never use:** OpenAI API, Anthropic API, Google Vision, AWS, Docker, Prisma, tRPC, Redis, or any package not already in `package.json`.

---

## Environment variables

These must exist in `.env.local`. Never hardcode values. Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OCR_SPACE_API_KEY=
GROQ_API_KEY=
```

---

## Project structure

```
carouselbrain/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        # Landing page
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── callback/route.ts           # Supabase PKCE callback
│   ├── dashboard/page.tsx              # Extraction history library
│   ├── extract/page.tsx                # Upload + trigger extraction
│   └── result/[id]/page.tsx            # Structured output page
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   └── Spinner.tsx
│   ├── Navbar.tsx
│   ├── UploadZone.tsx
│   ├── ExtractionCard.tsx
│   └── ResultPage.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # createBrowserClient
│   │   └── server.ts                   # createServerClient (cookies)
│   ├── ocr.ts                          # OCR.space integration
│   ├── groq.ts                         # Groq LLM + extraction prompt
│   └── types.ts                        # Shared TS types
├── app/api/
│   ├── extract/route.ts                # POST: images → OCR → LLM → DB
│   ├── extractions/route.ts            # GET: user history list
│   └── extractions/[id]/route.ts       # GET: single extraction
├── supabase/
│   └── migrations/001_initial.sql
├── .env.local
├── AGENTS.md
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Database schema (source of truth)

The full schema is in `supabase/migrations/001_initial.sql`. Key facts:

- `profiles` table mirrors `auth.users`, auto-created via trigger on signup
- `extractions` table is the core: stores status, image URLs, raw OCR text, and structured `output` as JSONB
- RLS is enabled on both tables — users can only read/write their own rows
- `content_hash` on `extractions` is a SHA-256 hash computed server-side from sorted `filename:filesize` pairs — used for caching to avoid reprocessing identical uploads
- Storage bucket name: `carousel-images` (private, not public)

---

## LLM output schema (ExtractionOutput)

The Groq call must return this exact JSON shape. Stored in `extractions.output` (JSONB):

```typescript
interface ExtractionOutput {
  main_topic: string;       // e.g. "Machine Learning Roadmap 2025"
  summary: string;          // 2-3 sentence plain-English summary
  key_insights: string[];   // 3-7 complete, useful sentences
  action_steps: string[];   // 3-6 verb-first actionable items
  resources: Array<{
    name: string;
    type: 'book' | 'tool' | 'course' | 'link' | 'person' | 'framework';
    url: string | null;
    description: string;
  }>;
  concepts: Array<{
    term: string;
    definition: string;     // 1-2 sentences, plain English
  }>;
  learning_path: string[];  // 3-8 ordered steps, beginner to advanced
  tags: string[];           // 3-6 lowercase hyphenated topic tags
}
```

---

## API route behavior

### POST /api/extract
1. Auth check — 401 if not logged in
2. Parse FormData — accept JPEG/PNG/WEBP only, max 10 files, max 5MB each
3. Compute `content_hash` server-side (SHA-256 of sorted `filename:size` strings)
4. Cache check — if hash exists in DB with `status = 'done'`, return `{ cached: true, extraction_id }` immediately
5. Insert extraction row with `status = 'processing'`
6. Return HTTP 202 with `{ extraction_id }` immediately — do not await OCR/LLM
7. Fire-and-forget: upload images to Supabase Storage → OCR each → concatenate text → call Groq → update row to `status = 'done'` with output
8. On any error: update row to `status = 'error'` with `error_message`

### GET /api/extractions
- Auth required, returns last 50 extractions for the user, ordered by `created_at DESC`
- Returns only list fields: `id, title, status, created_at, output->>'main_topic', output->'tags'`

### GET /api/extractions/[id]
- Auth required, verifies ownership, returns full extraction row

---

## Architectural decisions (do not reverse these)

1. **Upload-only MVP** — no URL scraping, no Instagram API integration
2. **OCR before LLM** — never send raw images to multimodal APIs, always OCR first to keep costs at ~$0.001/extraction
3. **Async 202 pattern** — extract route returns immediately, frontend polls every 2 seconds
4. **Content hash caching** — identical uploads return cached results without re-running OCR/LLM
5. **Supabase for everything** — auth, DB, storage in one service, no additional infra
6. **No rate limiting in MVP** — add a `// TODO: rate limit before launch` comment in the extract route

---

## Code conventions

- All new code in TypeScript with `strict: true`
- No `any` types — use `unknown` and narrow properly
- Tailwind only for styling — no inline style objects except for dynamic values Tailwind can't express
- Server components by default in App Router — add `'use client'` only when needed (event handlers, hooks, browser APIs)
- All API routes must call `supabase.auth.getUser()` before any DB operation
- Error responses: `{ error: string }` with correct HTTP status code
- Every async UI action needs a loading state and error state
- Empty states required on every list/grid — never leave a blank screen

---

## Commands

```bash
npm run dev          # start local dev server
npm run build        # production build (must succeed with zero errors)
npm run typecheck    # tsc --noEmit (run after any change)
npm run lint         # eslint
```

After any edit, run `npm run typecheck` and fix all errors before stopping.

---

## Setup checklist (for the developer, not Codex)

```
[ ] Create Supabase project → copy URL + keys to .env.local
[ ] Run supabase/migrations/001_initial.sql in Supabase SQL editor
[ ] Create storage bucket named 'carousel-images' (private) in Supabase dashboard
[ ] Get OCR.space free API key at ocr.space/ocrapi
[ ] Get Groq API key at console.groq.com
[ ] npm install && npm run dev
[ ] Sign in with magic link, upload a carousel, verify full flow
[ ] npx vercel --prod to deploy
```
