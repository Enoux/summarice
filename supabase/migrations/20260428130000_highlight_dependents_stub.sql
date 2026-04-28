-- Stub dependents for highlight delete semantics (#04): embeddings CASCADE (#09), citations SET NULL (#08).
-- #09 extends highlight_embeddings (vector, model, etc.); #08 adds summary_citations columns, FKs, and RLS policies.

create table public.highlight_embeddings (
  highlight_id uuid primary key references public.highlights (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.highlight_embeddings enable row level security;

create policy "Users can view own highlight embeddings"
  on public.highlight_embeddings for select
  using (
    exists (
      select 1 from public.highlights h
      where h.id = highlight_id and h.owner_id = auth.uid()
    )
  );

create policy "Users can insert own highlight embeddings"
  on public.highlight_embeddings for insert
  with check (
    exists (
      select 1 from public.highlights h
      where h.id = highlight_id and h.owner_id = auth.uid()
    )
  );

create policy "Users can update own highlight embeddings"
  on public.highlight_embeddings for update
  using (
    exists (
      select 1 from public.highlights h
      where h.id = highlight_id and h.owner_id = auth.uid()
    )
  );

create policy "Users can delete own highlight embeddings"
  on public.highlight_embeddings for delete
  using (
    exists (
      select 1 from public.highlights h
      where h.id = highlight_id and h.owner_id = auth.uid()
    )
  );

-- highlight_id nullable: ON DELETE SET NULL when the cited highlight is removed (Decision F4, #08).
-- RLS: no policies yet — default deny for authenticated; adds policies when summaries and writes land.
create table public.summary_citations (
  id uuid primary key default gen_random_uuid(),
  highlight_id uuid references public.highlights (id) on delete set null,
  summary_id uuid,
  created_at timestamptz not null default now()
);

create index summary_citations_highlight_id_idx on public.summary_citations (highlight_id);

alter table public.summary_citations enable row level security;
