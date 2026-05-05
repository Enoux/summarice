# 🗄️ Database Layer (`src/lib/server/supabase/`)

This module manages all **Supabase clients and RLS-safe repositories**. It is the **only** place in the application that directly interacts with Postgres or Supabase Storage. 

## 🏗️ Architecture & Contents

To maintain a secure and decoupled architecture, this directory contains:

- **Auth-Scoped Clients:** A request-scoped Supabase client factory that securely carries the user's authentication context. This ensures that Postgres Row Level Security (RLS) policies successfully enforce multi-tenancy.
- **Admin Clients:** A separate service-role client reserved *strictly* for admin paths. It should never be used from a request handler that processes untrusted user input.
- **Entity Repositories:** One repository file per database entity (e.g., `documents.ts`, `highlights.ts`, `summaries.ts`). These repositories wrap the raw Supabase queries and return strongly-typed domain objects.
- **SQL Helpers:** Utilities for complex database operations that don't cleanly fit into the standard `supabase-js` API, such as hybrid queries combining `pgvector` and Full Text Search (FTS).

## 📜 Core Conventions

- **Repository Pattern:** API routes and other `server/*` modules must **always** call the repositories. They should never interact with the raw Supabase client directly.
- **Always Assume RLS:** Every read and write operation is assumed to be protected by RLS. If you ever need to bypass RLS (using the service role key), you **must** document the reasoning clearly in a comment.
