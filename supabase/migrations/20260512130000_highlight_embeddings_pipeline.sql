create schema if not exists extensions;

-- Supabase Cloud installs `vector` in `public`; use public.vector (not extensions.vector).
alter table public.highlight_embeddings
  add column if not exists model text,
  add column if not exists embedding public.vector(1536),
  add column if not exists enriched_input text,
  add column if not exists status text not null default 'pending',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists processing_started_at timestamptz,
  add column if not exists next_retry_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.highlight_embeddings
  drop constraint if exists highlight_embeddings_status_check;

alter table public.highlight_embeddings
  add constraint highlight_embeddings_status_check
    check (status in ('pending', 'processing', 'success', 'failed'));

alter table public.highlight_embeddings
  drop constraint if exists highlight_embeddings_attempt_count_check;

alter table public.highlight_embeddings
  add constraint highlight_embeddings_attempt_count_check
    check (attempt_count >= 0);

create index if not exists highlight_embeddings_due_idx
  on public.highlight_embeddings (status, next_retry_at, updated_at);

create index if not exists highlight_embeddings_embedding_hnsw_idx
  on public.highlight_embeddings
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;
