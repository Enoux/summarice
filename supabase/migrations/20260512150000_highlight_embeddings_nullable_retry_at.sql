alter table public.highlight_embeddings
  alter column next_retry_at drop not null;
