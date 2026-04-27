# Summarice

A reading workspace for academic PDFs: highlight, annotate, summarize with citations, and search across your library. Built for CS 180.

## How to run

```bash
pnpm install
pnpm dev                      # http://localhost:5173
```

Other scripts: `pnpm check` (svelte-check), `pnpm lint`, `pnpm format`, `pnpm test:e2e`.

## Top-level layout

```
src/                  SvelteKit app (routes + lib + components)
  routes/             Pages, grouped into (auth) and (app)
  lib/                Shared code (client + server)
    components/       UI: shadcn primitives + feature components
    pdf-highlighter/  Vendored PDF highlighter fork
    citations/        Markdown citation parsing/rendering
    domain/           Shared types, DTOs, zod schemas
    server/           Server-only modules (AI, Supabase, retrieval, ingestion, summary, figures)
static/               Static assets served as-is
data/                 Sample PDFs for development (AIC, Abstract, FullText)
supabase/             DB migrations, seed, Supabase CLI config
eval/                 Python evaluation harness (deferred — Issues 14–16)
e2e/                  Playwright tests
```

Most folders have a short README explaining what lives there. Start with `src/lib/server/README.md` for backend work, or `src/routes/README.md` for pages.

## Stack

SvelteKit 2 + Svelte 5 · TypeScript · Tailwind 4 · shadcn-svelte · Supabase (Postgres, Storage, Auth, pgvector, FTS) · Gemini 2.5 Flash · OpenAI text-embedding-3-small · pdf.js · Playwright.

## Highlighting (Issue 04)

- Text and area highlights persist to Supabase and render in the right sidebar.
- Semantic highlighting uses fixed slots `1..5` (Key idea, Definition, Evidence, Question, Contradiction).
- Keyboard shortcuts `1..5` set the active category slot for new highlights.
- Decorative mode is supported via settings (highlights store `category = null` and use free colors).

## Team

- Carlyne Consebido
- Benjeouelle Lazaro
- Raymund Klien Mañago
- Phoebe Renee Moraca
