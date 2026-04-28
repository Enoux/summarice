# `lib/server/`

Server-only code. Anything in this folder is **never bundled into the browser** — SvelteKit enforces this. Put database queries, AI provider calls, secrets-touching code, and prompt builders here.

## Modules

Each subfolder is a technical module. Most are `.gitkeep`-only today.

| Folder        | Purpose                                                                |
|---------------|------------------------------------------------------------------------|
| `supabase/`   | Supabase clients, RLS-safe repositories, SQL helpers                   |
| `ingestion/`  | PDF upload pipeline: text extraction, outline, density scan            |
| `ai/`         | AI Provider Port, prompts, stream normalization (Gemini, OpenAI)       |
| `summary/`    | Summary generator: prompts, citation validation                        |
| `retrieval/`  | Hybrid search: vector + FTS, RRF fusion, MMR diversification           |
| `figures/`    | Figure interpreter (Nice tier)                                         |
| `env.ts`      | Zod-validated server env. Boot fails fast if a required var is missing | —      |

## Conventions

- **Tenancy.** Every query goes through repositories that respect Supabase RLS (auth.uid()-keyed). Never bypass it with the service role key except in clearly-scoped admin paths.
- **Provider port.** AI calls go through `ai/` — no direct `fetch()` to model APIs from `summary/`, `retrieval/`, etc. This keeps providers swappable.
- **Telemetry.** Every model call writes a row to `llm_calls`.

