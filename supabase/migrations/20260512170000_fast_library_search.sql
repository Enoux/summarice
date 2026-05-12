create table public.searches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  query text not null,
  text_query text not null,
  parsed_filters jsonb not null,
  stage_counts jsonb not null,
  ordered_result_ids jsonb not null,
  latency_ms integer not null check (latency_ms >= 0),
  created_at timestamptz not null default now()
);

create index searches_owner_id_created_at_idx
  on public.searches (owner_id, created_at desc);

alter table public.searches enable row level security;

create policy "Users can view own searches"
  on public.searches for select
  using (auth.uid() = owner_id);

create policy "Users can insert own searches"
  on public.searches for insert
  with check (auth.uid() = owner_id);

create or replace function public.summaries_update_tsvector()
returns trigger
language plpgsql
as $$
begin
  new.generated_tsvector := to_tsvector(
    'english',
    coalesce(new.markdown, '') || ' ' || array_to_string(new.tags || new.entities, ' ')
  );
  return new;
end;
$$;

drop trigger if exists summaries_update_tsvector on public.summaries;

create trigger summaries_update_tsvector
  before insert or update of markdown, tags, entities
  on public.summaries
  for each row
  execute function public.summaries_update_tsvector();

update public.summaries
set generated_tsvector = to_tsvector(
  'english',
  coalesce(markdown, '') || ' ' || array_to_string(tags || entities, ' ')
);

create or replace function public.fast_search_vector_candidates(
  p_owner_id uuid,
  p_query_embedding public.vector,
  p_document_title text,
  p_color text,
  p_has_note boolean,
  p_page_start integer,
  p_page_end integer,
  p_limit integer
) returns table (
  highlight_id uuid,
  document_id uuid,
  document_title text,
  page_number integer,
  kind text,
  text text,
  annotation_preview text,
  color text,
  embedding public.vector,
  rank integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with annotation_rollup as (
    select
      a.highlight_id,
      string_agg(a.body, ' ' order by a.created_at) as annotation_preview
    from public.annotations a
    where a.owner_id = p_owner_id
    group by a.highlight_id
  ),
  color_filter as (
    select case lower(p_color)
      when 'yellow' then '#facc15'
      when 'green' then '#22c55e'
      when 'blue' then '#3b82f6'
      when 'pink' then '#ec4899'
      when 'orange' then '#f97316'
      else p_color
    end as value
  ),
  ranked as (
    select
      h.id as highlight_id,
      h.document_id,
      d.title as document_title,
      h.page_number,
      h.kind,
      h.text,
      left(ar.annotation_preview, 240) as annotation_preview,
      h.color,
      he.embedding,
      row_number() over (order by he.embedding <=> p_query_embedding) as rank
    from public.highlight_embeddings he
    join public.highlights h on h.id = he.highlight_id
    join public.documents d on d.id = h.document_id
    join color_filter cf on true
    left join public.user_settings us on us.id = h.owner_id
    left join annotation_rollup ar on ar.highlight_id = h.id
    where h.owner_id = p_owner_id
      and d.owner_id = p_owner_id
      and he.status = 'success'
      and he.embedding is not null
      and (p_document_title is null or d.title ilike '%' || p_document_title || '%')
      and (
        cf.value is null
        or lower(h.color) = lower(cf.value)
        or h.category::text = cf.value
        or lower(regexp_replace(coalesce(us.category_labels->>h.category::text, ''), '\s+', '', 'g')) = lower(cf.value)
      )
      and (not p_has_note or nullif(trim(coalesce(h.comment, '') || ' ' || coalesce(ar.annotation_preview, '')), '') is not null)
      and (p_page_start is null or h.page_number >= p_page_start)
      and (p_page_end is null or h.page_number <= p_page_end)
    order by he.embedding <=> p_query_embedding
    limit p_limit
  )
  select * from ranked;
$$;

create or replace function public.fast_search_lexical_candidates(
  p_owner_id uuid,
  p_text_query text,
  p_document_title text,
  p_color text,
  p_has_note boolean,
  p_page_start integer,
  p_page_end integer,
  p_limit integer
) returns table (
  highlight_id uuid,
  document_id uuid,
  document_title text,
  page_number integer,
  kind text,
  text text,
  annotation_preview text,
  color text,
  embedding public.vector,
  rank integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with query as (
    select
      nullif(trim(p_text_query), '') as raw_text,
      case
        when nullif(trim(p_text_query), '') is null then null
        else websearch_to_tsquery('english', p_text_query)
      end as tsq
  ),
  color_filter as (
    select case lower(p_color)
      when 'yellow' then '#facc15'
      when 'green' then '#22c55e'
      when 'blue' then '#3b82f6'
      when 'pink' then '#ec4899'
      when 'orange' then '#f97316'
      else p_color
    end as value
  ),
  annotation_rollup as (
    select
      a.highlight_id,
      string_agg(a.body, ' ' order by a.created_at) as annotation_preview
    from public.annotations a
    where a.owner_id = p_owner_id
    group by a.highlight_id
  ),
  summary_matches as (
    select
      sc.highlight_id,
      max(
        ts_rank(
          to_tsvector(
            'english',
            coalesce(s.markdown, '') || ' ' || array_to_string(s.tags || s.entities, ' ')
          ),
          q.tsq
        )
      ) as summary_rank
    from public.summaries s
    join query q on true
    join public.summary_citations sc on sc.summary_id = s.id
    where q.tsq is not null
      and s.owner_id = p_owner_id
      and s.is_current
      and sc.highlight_id is not null
      and s.generated_tsvector @@ q.tsq
    group by sc.highlight_id
  ),
  scored as (
    select
      h.id as highlight_id,
      h.document_id,
      d.title as document_title,
      h.page_number,
      h.kind,
      h.text,
      left(ar.annotation_preview, 240) as annotation_preview,
      h.color,
      he.embedding,
      greatest(
        case
          when q.tsq is null then 1
          else ts_rank(
            to_tsvector(
              'english',
              coalesce(h.text, '') || ' ' || coalesce(h.comment, '') || ' ' || coalesce(ar.annotation_preview, '')
            ),
            q.tsq
          )
        end,
        coalesce(sm.summary_rank, 0)
      ) as lexical_score
    from public.highlights h
    join public.documents d on d.id = h.document_id
    join query q on true
    join color_filter cf on true
    left join public.user_settings us on us.id = h.owner_id
    left join annotation_rollup ar on ar.highlight_id = h.id
    left join summary_matches sm on sm.highlight_id = h.id
    left join public.highlight_embeddings he
      on he.highlight_id = h.id
     and he.status = 'success'
    where h.owner_id = p_owner_id
      and d.owner_id = p_owner_id
      and (p_document_title is null or d.title ilike '%' || p_document_title || '%')
      and (
        cf.value is null
        or lower(h.color) = lower(cf.value)
        or h.category::text = cf.value
        or lower(regexp_replace(coalesce(us.category_labels->>h.category::text, ''), '\s+', '', 'g')) = lower(cf.value)
      )
      and (not p_has_note or nullif(trim(coalesce(h.comment, '') || ' ' || coalesce(ar.annotation_preview, '')), '') is not null)
      and (p_page_start is null or h.page_number >= p_page_start)
      and (p_page_end is null or h.page_number <= p_page_end)
  ),
  ranked as (
    select
      scored.highlight_id,
      scored.document_id,
      scored.document_title,
      scored.page_number,
      scored.kind,
      scored.text,
      scored.annotation_preview,
      scored.color,
      scored.embedding,
      row_number() over (order by lexical_score desc, page_number asc, highlight_id asc) as rank
    from scored
    where lexical_score > 0
    order by lexical_score desc, page_number asc, highlight_id asc
    limit p_limit
  )
  select * from ranked;
$$;

grant execute on function public.fast_search_vector_candidates(uuid, public.vector, text, text, boolean, integer, integer, integer) to authenticated;
grant execute on function public.fast_search_lexical_candidates(uuid, text, text, text, boolean, integer, integer, integer) to authenticated;
