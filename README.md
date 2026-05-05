# Summarice

A reading workspace for academic PDFs: highlight, annotate, summarize with citations, and search across your library.

## How to run

```bash
pnpm install
pnpm dev                      # http://localhost:5173
```

Other scripts: `pnpm check` (svelte-check), `pnpm lint`, `pnpm format`, `pnpm test:e2e`.

## Top-level layout

```
src/                  SvelteKit app (routes + lib)
  routes/             Pages, grouped into (auth) and (app)
  lib/                Shared code (client + server)
    components/       Common UI: shadcn primitives + shared components
    features/         Feature components and logic (highlights, document-upload, summary, viewer)
    pdf-highlighter/  Vendored PDF highlighter fork
    server/           Server-only modules (AI, Supabase, document-upload, summary, figures, limits)
static/               Static assets served as-is
data/                 Sample PDFs for development
supabase/             DB migrations, seed, Supabase CLI config
eval/                 Python evaluation harness (deferred)
e2e/                  Playwright tests
```

Most folders have a short README explaining what lives there. Start with `src/lib/server/README.md` for backend work, or `src/routes/README.md` for pages.

## Stack

SvelteKit 2 + Svelte 5 · TypeScript · Tailwind 4 · shadcn-svelte · Supabase (Postgres, Storage, Auth, pgvector, FTS) · Gemini 3 Flash · OpenAI text-embedding-3-small · pdf.js · Playwright.

## Features

- **Highlighting**: Text and area highlights persist to Supabase and render in the right sidebar. Semantic highlighting uses fixed slots `1..5` (Key idea, Definition, Evidence, Question, Contradiction).
- **Summaries**: Automated, versioned document summaries with interactive citations linked back to source highlights.
- **Figure Interpretation**: Multimodal AI interpretation of area highlights to describe diagrams and charts.
- **Annotations**: Markdown notes on highlights with support for AI-authored content and CRUD operations.

## Team

- Carlyne Consebido
- Benjeouelle Lazaro
- Raymund Klien Mañago
- Phoebe Renee Moraca
