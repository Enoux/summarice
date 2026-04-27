# `src/lib/`

Shared code consumed by routes. Anything imported as `$lib/...` lives here.

## What lives here

- `components/` — UI: shadcn primitives (`ui/`) and feature components (`viewer/`, `dashboard/`, `shared/`).
- `pdf-highlighter/` — Vendored fork of the PDF highlighter library. **Do not refactor casually** — keeping it close to upstream makes future merges easier.
- `citations/` — Markdown `[^n]` citation parsing and rendering helpers (used on both client and server).
- `domain/` — Shared types, DTOs, zod schemas. The contract between routes, components, and `server/`.
- `server/` — **Server-only** code. Never bundled to the browser. AI, Supabase, retrieval, ingestion, summary, figures.
- `hooks/` — Svelte/runtime hooks (e.g. `handle` for SvelteKit).
- `index.ts`, `utils.ts`, `pdf-worker-url.ts` — small top-level helpers.

## Boundary

Anything under `server/` cannot be imported from a `+page.svelte`, `+layout.svelte`, or any `.svelte` file — only from `+page.server.ts`, `+layout.server.ts`, `+server.ts`, and other server-only files. SvelteKit will throw a build error if you cross the boundary.
