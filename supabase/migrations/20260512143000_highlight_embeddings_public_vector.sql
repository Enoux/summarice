create extension if not exists vector with schema public;

drop index if exists public.highlight_embeddings_embedding_hnsw_idx;

create index if not exists highlight_embeddings_embedding_hnsw_idx
  on public.highlight_embeddings
  using hnsw (embedding public.vector_cosine_ops)
  where embedding is not null;
