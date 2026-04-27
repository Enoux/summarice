# `lib/server/`

Server-only code. Anything in this folder is **never bundled into the browser** — SvelteKit enforces this. Put database queries, AI provider calls, secrets-touching code, and prompt builders here.

## Modules

Each subfolder is a technical seam from the architecture doc's module map. Most are `.gitkeep`-only today and will be filled in by the listed issue.

| Folder        | Purpose                                                                | Issue  |
|---------------|------------------------------------------------------------------------|--------|
| `supabase/`   | Supabase clients, RLS-safe repositories, SQL helpers                   | 01     |
| `ingestion/`  | PDF upload pipeline: text extraction, outline, density scan            | 02–04  |
| `ai/`         | AI Provider Port, prompts, stream normalization (Gemini, OpenAI)       | 05–06  |
| `summary/`    | Summary generator: prompts, citation validation                        | 07     |
| `retrieval/`  | Hybrid search: vector + FTS, RRF fusion, MMR diversification           | 09–11  |
| `figures/`    | Figure interpreter (Nice tier)                                         | 06     |
| `env.ts`      | Zod-validated server env. Boot fails fast if a required var is missing | —      |

## Conventions

- **Tenancy.** Every query goes through repositories that respect Supabase RLS (auth.uid()-keyed). Never bypass it with the service role key except in clearly-scoped admin paths.
- **Provider port.** AI calls go through `ai/` — no direct `fetch()` to model APIs from `summary/`, `retrieval/`, etc. This keeps providers swappable.
- **Telemetry.** Every model call writes a row to `llm_calls` (see architecture doc § 1).

