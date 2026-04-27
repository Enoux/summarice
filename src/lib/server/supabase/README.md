# `server/supabase/`

Supabase clients and **RLS-safe repositories**. The only place in the app that touches Postgres or Storage directly.

## What goes here

- A request-scoped Supabase client factory that carries the user's auth context (so RLS policies enforce tenancy).
- A separate service-role client for admin paths only (used sparingly, never from a request handler that takes user input).
- One repository module per entity (`documents.ts`, `highlights.ts`, `summaries.ts`, etc.) — these wrap raw queries and return domain types from `lib/domain/`.
- SQL helpers for things that don't fit the supabase-js API cleanly (e.g. pgvector + FTS hybrid queries).

## Conventions

- Routes and other `server/*` modules call repositories — never the Supabase client directly.
- Every read/write assumes RLS is on. If you need to bypass it, document why in a comment.

Currently `.gitkeep`-only. Foundation lands in **Issue 01**.

