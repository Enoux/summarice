-- Versioned per-document summaries + citation finalize RPC.

create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  version integer not null check (version > 0),
  is_current boolean not null default true,
  markdown text not null,
  tags text[] not null default '{}',
  entities text[] not null default '{}',
  open_questions text[] not null default '{}',
  generated_tsvector tsvector,
  model text,
  prompt_tokens integer check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens integer check (completion_tokens is null or completion_tokens >= 0),
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

create or replace function public.summaries_update_tsvector()
returns trigger
language plpgsql
as $$
begin
  new.generated_tsvector := to_tsvector('english', array_to_string(new.tags || new.entities, ' '));
  return new;
end;
$$;

create trigger summaries_update_tsvector
  before insert or update of tags, entities
  on public.summaries
  for each row
  execute function public.summaries_update_tsvector();

create unique index summaries_current_document_idx
  on public.summaries (document_id)
  where is_current;

create index summaries_owner_id_created_at_idx
  on public.summaries (owner_id, created_at desc);

create index summaries_document_id_created_at_idx
  on public.summaries (document_id, created_at desc);

create index summaries_generated_tsvector_idx
  on public.summaries using gin (generated_tsvector);

alter table public.summaries enable row level security;

create policy "Users can view own summaries"
  on public.summaries for select
  using (auth.uid() = owner_id);

create policy "Users can insert own summaries"
  on public.summaries for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.owner_id = auth.uid()
    )
  );

create policy "Users can update own summaries"
  on public.summaries for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can delete own summaries"
  on public.summaries for delete
  using (auth.uid() = owner_id);

alter table public.summary_citations
  add column ordinal integer,
  add column occurrence_index integer,
  add constraint summary_citations_summary_id_fkey
    foreign key (summary_id) references public.summaries (id) on delete cascade;

update public.summary_citations
set occurrence_index = 0
where occurrence_index is null;

alter table public.summary_citations
  alter column summary_id set not null,
  alter column ordinal set not null,
  alter column occurrence_index set not null;

alter table public.summary_citations
  add constraint summary_citations_ordinal_check
    check (ordinal > 0),
  add constraint summary_citations_occurrence_index_check
    check (occurrence_index >= 0);

create index summary_citations_summary_id_idx
  on public.summary_citations (summary_id);

create unique index summary_citations_summary_ordinal_occurrence_idx
  on public.summary_citations (summary_id, ordinal, occurrence_index);

create or replace function public.validate_summary_citation_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary_document_id uuid;
  v_summary_owner_id uuid;
  v_highlight_document_id uuid;
  v_highlight_owner_id uuid;
  v_highlight_ordinal integer;
begin
  select s.document_id, s.owner_id
  into v_summary_document_id, v_summary_owner_id
  from public.summaries s
  where s.id = new.summary_id;

  if not found then
    raise exception 'summary not found';
  end if;

  if new.highlight_id is not null then
    select h.document_id, h.owner_id, h.ordinal
    into v_highlight_document_id, v_highlight_owner_id, v_highlight_ordinal
    from public.highlights h
    where h.id = new.highlight_id;

    if not found then
      raise exception 'highlight not found';
    end if;

    if v_highlight_document_id <> v_summary_document_id then
      raise exception 'highlight does not belong to summary document';
    end if;

    if v_highlight_owner_id <> v_summary_owner_id then
      raise exception 'highlight does not belong to summary owner';
    end if;

    if new.ordinal <> v_highlight_ordinal then
      raise exception 'citation ordinal does not match highlight ordinal';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_summary_citation_consistency
  before insert or update of summary_id, highlight_id, ordinal
  on public.summary_citations
  for each row
  execute function public.validate_summary_citation_consistency();

create policy "Users can view own summary citations"
  on public.summary_citations for select
  using (
    exists (
      select 1 from public.summaries s
      where s.id = summary_id and s.owner_id = auth.uid()
    )
  );

create policy "Users can insert own summary citations"
  on public.summary_citations for insert
  with check (
    exists (
      select 1 from public.summaries s
      where s.id = summary_id and s.owner_id = auth.uid()
    )
    and (
      highlight_id is null
      or exists (
        select 1
        from public.summaries s
        join public.highlights h
          on h.id = highlight_id
         and h.document_id = s.document_id
         and h.owner_id = s.owner_id
         and h.ordinal = ordinal
        where s.id = summary_id
          and s.owner_id = auth.uid()
      )
    )
  );

create policy "Users can update own summary citations"
  on public.summary_citations for update
  using (
    exists (
      select 1 from public.summaries s
      where s.id = summary_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.summaries s
      where s.id = summary_id and s.owner_id = auth.uid()
    )
    and (
      highlight_id is null
      or exists (
        select 1
        from public.summaries s
        join public.highlights h
          on h.id = highlight_id
         and h.document_id = s.document_id
         and h.owner_id = s.owner_id
         and h.ordinal = ordinal
        where s.id = summary_id
          and s.owner_id = auth.uid()
      )
    )
  );

create policy "Users can delete own summary citations"
  on public.summary_citations for delete
  using (
    exists (
      select 1 from public.summaries s
      where s.id = summary_id and s.owner_id = auth.uid()
    )
  );

create or replace function public.generate_summary_finalize(
  p_document_id uuid,
  p_markdown text,
  p_tags text[],
  p_entities text[],
  p_open_questions text[],
  p_model text,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_citations jsonb default '[]'::jsonb
) returns public.summaries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary public.summaries;
  v_version integer;
  v_citation_count integer;
  v_valid_citation_count integer;
  v_matched_citation_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.documents d
    where d.id = p_document_id and d.owner_id = auth.uid()
  ) then
    raise exception 'document not found or forbidden';
  end if;

  if p_markdown is null or trim(p_markdown) = '' then
    raise exception 'summary markdown is required';
  end if;

  if jsonb_typeof(p_citations) <> 'array' then
    raise exception 'citations payload must be a JSON array';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_document_id::text));

  select coalesce(max(s.version), 0) + 1
  into v_version
  from public.summaries s
  where s.document_id = p_document_id;

  update public.summaries
  set is_current = false
  where document_id = p_document_id
    and is_current;

  insert into public.summaries (
    document_id,
    owner_id,
    version,
    markdown,
    is_current,
    tags,
    entities,
    open_questions,
    model,
    prompt_tokens,
    completion_tokens
  )
  values (
    p_document_id,
    auth.uid(),
    v_version,
    p_markdown,
    true,
    coalesce(p_tags, '{}'),
    coalesce(p_entities, '{}'),
    coalesce(p_open_questions, '{}'),
    p_model,
    p_prompt_tokens,
    p_completion_tokens
  )
  returning * into v_summary;

  insert into public.llm_calls (
    owner_id,
    document_id,
    provider,
    model,
    use_case,
    status,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    usage
  )
  values (
    auth.uid(),
    p_document_id,
    'openrouter',
    coalesce(p_model, 'google/gemini-2.5-flash'),
    'summary_generate',
    'completed',
    p_prompt_tokens,
    p_completion_tokens,
    case
      when p_prompt_tokens is null or p_completion_tokens is null then null
      else p_prompt_tokens + p_completion_tokens
    end,
    jsonb_strip_nulls(
      jsonb_build_object(
        'promptTokens', p_prompt_tokens,
        'completionTokens', p_completion_tokens,
        'totalTokens',
          case
            when p_prompt_tokens is null or p_completion_tokens is null then null
            else p_prompt_tokens + p_completion_tokens
          end
      )
    )
  );

  with raw_citations as (
    select value as citation
    from jsonb_array_elements(p_citations)
  )
  select count(*)
  into v_citation_count
  from raw_citations;

  with raw_citations as (
    select value as citation
    from jsonb_array_elements(p_citations)
  )
  select count(*)
  into v_valid_citation_count
  from raw_citations
  where jsonb_typeof(citation) = 'object'
    and coalesce(citation->>'ordinal', '') ~ '^[1-9][0-9]*$'
    and coalesce(citation->>'occurrenceIndex', '') ~ '^[0-9]+$';

  if v_valid_citation_count <> v_citation_count then
    raise exception 'citations payload contains invalid entries';
  end if;

  with parsed_citations as (
    select
      (value->>'ordinal')::integer as ordinal,
      (value->>'occurrenceIndex')::integer as occurrence_index
    from jsonb_array_elements(p_citations)
  ),
  matched_highlights as (
    select
      pc.ordinal,
      pc.occurrence_index,
      h.id as highlight_id
    from parsed_citations pc
    join public.highlights h
      on h.document_id = p_document_id
     and h.ordinal = pc.ordinal
  )
  select count(*)
  into v_matched_citation_count
  from matched_highlights;

  if v_matched_citation_count <> v_citation_count then
    raise exception 'citations payload references missing highlights';
  end if;

  insert into public.summary_citations (
    summary_id,
    highlight_id,
    ordinal,
    occurrence_index
  )
  select
    v_summary.id,
    h.id,
    pc.ordinal,
    pc.occurrence_index
  from (
    select
      (value->>'ordinal')::integer as ordinal,
      (value->>'occurrenceIndex')::integer as occurrence_index
    from jsonb_array_elements(p_citations)
  ) pc
  join public.highlights h
    on h.document_id = p_document_id
   and h.ordinal = pc.ordinal;

  return v_summary;
end;
$$;

revoke all on function public.generate_summary_finalize(uuid, text, text[], text[], text[], text, integer, integer, jsonb) from public;
grant execute on function public.generate_summary_finalize(uuid, text, text[], text[], text[], text, integer, integer, jsonb) to authenticated;
