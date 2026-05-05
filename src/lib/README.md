# `src/lib/`

Shared code consumed by routes. Anything imported as `$lib/...` lives here.

## What lives here

- `components/` — Common UI: shadcn primitives (`ui/`) and shared components.
- `features/` — Feature-specific components and logic (highlights, document-upload, summary, viewer).
- `pdf-highlighter/` — Vendored fork of the PDF highlighter library.
- `server/` — **Server-only** code. Never bundled to the browser. AI, Supabase, document-upload, summary, figures, etc.
- `index.ts`, `utils.ts`, `pdf-worker-url.ts` — small top-level helpers.

## Boundary

Anything under `server/` cannot be imported from a `+page.svelte`, `+layout.svelte`, or any `.svelte` file — only from `+page.server.ts`, `+layout.server.ts`, `+server.ts`, and other server-only files. SvelteKit will throw a build error if you cross the boundary.
