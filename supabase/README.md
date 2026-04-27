# `supabase/`

Database schema, migrations, seed data, and Supabase CLI config. This is the contract between the app and Postgres.

## Layout

```
config.toml         Supabase CLI config (project id, ports, etc.)
migrations/         SQL migrations — one per logical concern
seed.sql            Demo seed data, run by `supabase db reset`
```

## Workflow

```bash
# First time on a new machine
supabase start                          # spins up local Postgres + services

# After pulling new migrations
supabase db reset                       # wipes local db, reapplies migrations + seed

# Authoring a new migration
supabase migration new <descriptive_name>
# edit the new file under migrations/
supabase db reset                       # to test locally
```

## Conventions

- **One migration per concern** (e.g. `0001_profiles.sql`, `0002_documents.sql`, `0003_highlights.sql`). Don't lump unrelated tables together.
- **RLS policies live inline** with the table that creates them — easier to review security per-table.
- **No manual edits to applied migrations.** If something is wrong, write a new migration that fixes it forward.
- **Service role key never appears in client code.** It's referenced only from `src/lib/server/supabase/`.

## Schema overview

Tables: `profiles`, `documents`, `document_pages`, `highlights`, `annotations`, `highlight_embeddings`, `summaries`, `summary_citations`, `llm_calls`.

