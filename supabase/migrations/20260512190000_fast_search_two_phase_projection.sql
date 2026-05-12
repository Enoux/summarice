create table if not exists public.fast_search_highlight_projection (
  highlight_id uuid primary key references public.highlights (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  document_title text not null,
  page_number integer not null,
  kind text not null,
  text text,
  comment text,
  annotation_preview text,
  color text not null,
  category integer,
  search_tsvector tsvector not null,
  updated_at timestamptz not null default now()
);

create index if not exists fast_search_highlight_projection_search_idx
  on public.fast_search_highlight_projection using gin (search_tsvector);

create index if not exists fast_search_highlight_projection_owner_document_idx
  on public.fast_search_highlight_projection (owner_id, document_id, page_number);

alter table public.fast_search_highlight_projection enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'fast_search_highlight_projection'
      and policyname = 'Users can view own fast search projection'
  ) then
    create policy "Users can view own fast search projection"
      on public.fast_search_highlight_projection for select
      using (auth.uid() = owner_id);
  end if;
end;
$$;

create or replace function public.refresh_fast_search_highlight_projection(p_highlight_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.fast_search_highlight_projection (
    highlight_id,
    owner_id,
    document_id,
    document_title,
    page_number,
    kind,
    text,
    comment,
    annotation_preview,
    color,
    category,
    search_tsvector,
    updated_at
  )
  select
    h.id,
    h.owner_id,
    h.document_id,
    d.title,
    h.page_number,
    h.kind,
    h.text,
    h.comment,
    left(coalesce(ar.annotation_preview, ''), 240),
    h.color,
    h.category,
    to_tsvector(
      'english',
      coalesce(h.text, '') || ' ' || coalesce(h.comment, '') || ' ' || coalesce(ar.annotation_preview, '')
    ),
    now()
  from public.highlights h
  join public.documents d on d.id = h.document_id
  left join lateral (
    select string_agg(a.body, ' ' order by a.created_at) as annotation_preview
    from public.annotations a
    where a.highlight_id = h.id
      and a.owner_id = h.owner_id
  ) ar on true
  where h.id = p_highlight_id
  on conflict (highlight_id) do update set
    owner_id = excluded.owner_id,
    document_id = excluded.document_id,
    document_title = excluded.document_title,
    page_number = excluded.page_number,
    kind = excluded.kind,
    text = excluded.text,
    comment = excluded.comment,
    annotation_preview = excluded.annotation_preview,
    color = excluded.color,
    category = excluded.category,
    search_tsvector = excluded.search_tsvector,
    updated_at = excluded.updated_at;
$$;

create or replace function public.fast_search_highlight_projection_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.fast_search_highlight_projection where highlight_id = old.id;
    return old;
  end if;

  perform public.refresh_fast_search_highlight_projection(new.id);
  return new;
end;
$$;

drop trigger if exists fast_search_highlight_projection_refresh on public.highlights;

create trigger fast_search_highlight_projection_refresh
  after insert or update or delete
  on public.highlights
  for each row
  execute function public.fast_search_highlight_projection_trigger();

create or replace function public.fast_search_annotation_projection_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_fast_search_highlight_projection(old.highlight_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and new.highlight_id is distinct from old.highlight_id then
    perform public.refresh_fast_search_highlight_projection(old.highlight_id);
  end if;

  perform public.refresh_fast_search_highlight_projection(new.highlight_id);
  return new;
end;
$$;

drop trigger if exists fast_search_annotation_projection_refresh on public.annotations;

create trigger fast_search_annotation_projection_refresh
  after insert or update or delete
  on public.annotations
  for each row
  execute function public.fast_search_annotation_projection_trigger();

insert into public.fast_search_highlight_projection (
  highlight_id,
  owner_id,
  document_id,
  document_title,
  page_number,
  kind,
  text,
  comment,
  annotation_preview,
  color,
  category,
  search_tsvector,
  updated_at
)
select
  h.id,
  h.owner_id,
  h.document_id,
  d.title,
  h.page_number,
  h.kind,
  h.text,
  h.comment,
  left(coalesce(ar.annotation_preview, ''), 240),
  h.color,
  h.category,
  to_tsvector(
    'english',
    coalesce(h.text, '') || ' ' || coalesce(h.comment, '') || ' ' || coalesce(ar.annotation_preview, '')
  ),
  now()
from public.highlights h
join public.documents d on d.id = h.document_id
left join lateral (
  select string_agg(a.body, ' ' order by a.created_at) as annotation_preview
  from public.annotations a
  where a.highlight_id = h.id
    and a.owner_id = h.owner_id
) ar on true
on conflict (highlight_id) do update set
  owner_id = excluded.owner_id,
  document_id = excluded.document_id,
  document_title = excluded.document_title,
  page_number = excluded.page_number,
  kind = excluded.kind,
  text = excluded.text,
  comment = excluded.comment,
  annotation_preview = excluded.annotation_preview,
  color = excluded.color,
  category = excluded.category,
  search_tsvector = excluded.search_tsvector,
  updated_at = excluded.updated_at;

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

create table if not exists public.fast_search_summary_block_projection (
  summary_id uuid not null references public.summaries (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  document_title text not null,
  block_index integer not null,
  block_text text not null,
  citation_ordinals integer[] not null,
  search_tsvector tsvector not null,
  updated_at timestamptz not null default now(),
  primary key (summary_id, block_index)
);

create index if not exists fast_search_summary_block_projection_search_idx
  on public.fast_search_summary_block_projection using gin (search_tsvector);

create index if not exists fast_search_summary_block_projection_owner_document_idx
  on public.fast_search_summary_block_projection (owner_id, document_id, block_index);

create index if not exists fast_search_summary_block_projection_document_idx
  on public.fast_search_summary_block_projection (document_id);

alter table public.fast_search_summary_block_projection enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'fast_search_summary_block_projection'
      and policyname = 'Users can view own fast summary search projection'
  ) then
    create policy "Users can view own fast summary search projection"
      on public.fast_search_summary_block_projection for select
      using (auth.uid() = owner_id);
  end if;
end;
$$;

create or replace function public.refresh_fast_search_summary_block_projection(p_summary_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.fast_search_summary_block_projection
  where summary_id = p_summary_id;

  insert into public.fast_search_summary_block_projection (
    summary_id,
    document_id,
    owner_id,
    document_title,
    block_index,
    block_text,
    citation_ordinals,
    search_tsvector,
    updated_at
  )
  select
    s.id,
    s.document_id,
    s.owner_id,
    d.title,
    block.block_index::integer,
    block.body,
    coalesce(citations.ordinals, '{}'::integer[]),
    to_tsvector('english', d.title || ' ' || block.body),
    now()
  from public.summaries s
  join public.documents d on d.id = s.document_id
  cross join lateral regexp_split_to_table(
    regexp_replace(
      s.markdown,
      E'(^|\\n)([[:space:]]*([-*+]|[0-9]+[.)])[[:space:]]+)',
      E'\\1\n\n\\2',
      'g'
    ),
    E'\\n[[:space:]]*\\n'
  ) with ordinality as block(body, block_index)
  left join lateral (
    select array_agg(distinct citation.matches[1]::integer order by citation.matches[1]::integer) as ordinals
    from regexp_matches(block.body, '\[\^([0-9]+)\]', 'g') as citation(matches)
  ) citations on true
  where s.id = p_summary_id
    and s.is_current
    and nullif(trim(block.body), '') is not null;
$$;

create or replace function public.fast_search_summary_block_projection_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.fast_search_summary_block_projection where summary_id = old.id;
    return old;
  end if;

  perform public.refresh_fast_search_summary_block_projection(new.id);
  return new;
end;
$$;

drop trigger if exists fast_search_summary_block_projection_refresh on public.summaries;

create trigger fast_search_summary_block_projection_refresh
  after insert or update or delete
  on public.summaries
  for each row
  execute function public.fast_search_summary_block_projection_trigger();

insert into public.fast_search_summary_block_projection (
  summary_id,
  document_id,
  owner_id,
  document_title,
  block_index,
  block_text,
  citation_ordinals,
  search_tsvector,
  updated_at
)
select
  s.id,
  s.document_id,
  s.owner_id,
  d.title,
  block.block_index::integer,
  block.body,
  coalesce(citations.ordinals, '{}'::integer[]),
  to_tsvector('english', d.title || ' ' || block.body),
  now()
from public.summaries s
join public.documents d on d.id = s.document_id
cross join lateral regexp_split_to_table(
  regexp_replace(
    s.markdown,
    E'(^|\\n)([[:space:]]*([-*+]|[0-9]+[.)])[[:space:]]+)',
    E'\\1\n\n\\2',
    'g'
  ),
  E'\\n[[:space:]]*\\n'
) with ordinality as block(body, block_index)
left join lateral (
  select array_agg(distinct citation.matches[1]::integer order by citation.matches[1]::integer) as ordinals
  from regexp_matches(block.body, '\[\^([0-9]+)\]', 'g') as citation(matches)
) citations on true
where s.is_current
  and nullif(trim(block.body), '') is not null
on conflict (summary_id, block_index) do update set
  document_id = excluded.document_id,
  owner_id = excluded.owner_id,
  document_title = excluded.document_title,
  block_text = excluded.block_text,
  citation_ordinals = excluded.citation_ordinals,
  search_tsvector = excluded.search_tsvector,
  updated_at = excluded.updated_at;

drop function if exists public.fast_search_vector_candidates(uuid, public.vector, text, text, boolean, integer, integer, integer);

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
  source text,
  summary_block text,
  similarity double precision,
  rank integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with color_filter as (
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
      p.highlight_id,
      p.document_id,
      p.document_title,
      p.page_number,
      p.kind,
      p.text,
      nullif(p.annotation_preview, '') as annotation_preview,
      p.color,
      he.embedding,
      'direct'::text as source,
      null::text as summary_block,
      1 - (he.embedding <=> p_query_embedding) as similarity,
      row_number() over (order by he.embedding <=> p_query_embedding) as rank
    from public.highlight_embeddings he
    join public.fast_search_highlight_projection p on p.highlight_id = he.highlight_id
    join color_filter cf on true
    left join public.user_settings us on us.id = p.owner_id
    where p.owner_id = p_owner_id
      and he.status = 'success'
      and he.embedding is not null
      and (p_document_title is null or p.document_title ilike '%' || p_document_title || '%')
      and (
        cf.value is null
        or lower(p.color) = lower(cf.value)
        or p.category::text = cf.value
        or lower(regexp_replace(coalesce(us.category_labels->>p.category::text, ''), '\s+', '', 'g')) = lower(cf.value)
      )
      and (not p_has_note or nullif(trim(coalesce(p.comment, '') || ' ' || coalesce(p.annotation_preview, '')), '') is not null)
      and (p_page_start is null or p.page_number >= p_page_start)
      and (p_page_end is null or p.page_number <= p_page_end)
    order by he.embedding <=> p_query_embedding
    limit p_limit
  )
  select * from ranked;
$$;

drop function if exists public.fast_search_lexical_candidates(uuid, text, text, text, boolean, integer, integer, integer);

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
  source text,
  summary_block text,
  similarity double precision,
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
  summary_matches as (
    select
      sc.highlight_id,
      max(ts_rank(sb.search_tsvector, q.tsq)) as summary_rank,
      max(sb.block_text) as summary_block
    from public.fast_search_summary_block_projection sb
    join query q on true
    join lateral unnest(sb.citation_ordinals) as citation(ordinal) on true
    join public.summary_citations sc
      on sc.summary_id = sb.summary_id
     and sc.ordinal = citation.ordinal
    where q.tsq is not null
      and sb.owner_id = p_owner_id
      and sc.highlight_id is not null
      and sb.search_tsvector @@ q.tsq
    group by sc.highlight_id
  ),
  direct_scored as (
    select
      p.highlight_id,
      p.document_id,
      p.document_title,
      p.page_number,
      p.kind,
      p.text,
      nullif(p.annotation_preview, '') as annotation_preview,
      p.color,
      he.embedding,
      'direct'::text as source,
      null::text as summary_block,
      case when q.tsq is null then 1 else ts_rank(p.search_tsvector, q.tsq) end as lexical_score
    from public.fast_search_highlight_projection p
    join query q on true
    join color_filter cf on true
    left join public.user_settings us on us.id = p.owner_id
    left join public.highlight_embeddings he
      on he.highlight_id = p.highlight_id
     and he.status = 'success'
    where p.owner_id = p_owner_id
      and (p_document_title is null or p.document_title ilike '%' || p_document_title || '%')
      and (
        cf.value is null
        or lower(p.color) = lower(cf.value)
        or p.category::text = cf.value
        or lower(regexp_replace(coalesce(us.category_labels->>p.category::text, ''), '\s+', '', 'g')) = lower(cf.value)
      )
      and (not p_has_note or nullif(trim(coalesce(p.comment, '') || ' ' || coalesce(p.annotation_preview, '')), '') is not null)
      and (p_page_start is null or p.page_number >= p_page_start)
      and (p_page_end is null or p.page_number <= p_page_end)
  ),
  summary_scored as (
    select
      p.highlight_id,
      p.document_id,
      p.document_title,
      p.page_number,
      p.kind,
      p.text,
      nullif(p.annotation_preview, '') as annotation_preview,
      p.color,
      he.embedding,
      'summary'::text as source,
      sm.summary_block,
      sm.summary_rank as lexical_score
    from summary_matches sm
    join public.fast_search_highlight_projection p on p.highlight_id = sm.highlight_id
    join color_filter cf on true
    left join public.user_settings us on us.id = p.owner_id
    left join public.highlight_embeddings he
      on he.highlight_id = p.highlight_id
     and he.status = 'success'
    where p.owner_id = p_owner_id
      and (p_document_title is null or p.document_title ilike '%' || p_document_title || '%')
      and (
        cf.value is null
        or lower(p.color) = lower(cf.value)
        or p.category::text = cf.value
        or lower(regexp_replace(coalesce(us.category_labels->>p.category::text, ''), '\s+', '', 'g')) = lower(cf.value)
      )
      and (not p_has_note or nullif(trim(coalesce(p.comment, '') || ' ' || coalesce(p.annotation_preview, '')), '') is not null)
      and (p_page_start is null or p.page_number >= p_page_start)
      and (p_page_end is null or p.page_number <= p_page_end)
  ),
  scored as (
    select * from direct_scored
    union all
    select * from summary_scored
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
      scored.source,
      scored.summary_block,
      null::double precision as similarity,
      row_number() over (order by lexical_score desc, page_number asc, highlight_id asc) as rank
    from scored
    where lexical_score > 0
    order by lexical_score desc, page_number asc, highlight_id asc
    limit p_limit
  )
  select * from ranked;
$$;

create or replace function public.fast_search_document_candidates(
  p_owner_id uuid,
  p_text_query text,
  p_document_title text,
  p_limit integer
) returns table (
  document_id uuid,
  document_title text,
  summary_block text,
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
  scored as (
    select
      d.id as document_id,
      d.title as document_title,
      coalesce(max(sb.block_text) filter (where sb.search_tsvector @@ q.tsq), d.title) as summary_block,
      greatest(
        ts_rank(to_tsvector('english', d.title), q.tsq),
        coalesce(max(ts_rank(sb.search_tsvector, q.tsq)) filter (where sb.search_tsvector @@ q.tsq), 0)
      ) as lexical_score
    from public.documents d
    join query q on true
    left join public.fast_search_summary_block_projection sb
      on sb.document_id = d.id
     and sb.owner_id = d.owner_id
    where q.tsq is not null
      and d.owner_id = p_owner_id
      and (
        to_tsvector('english', d.title) @@ q.tsq
        or sb.search_tsvector @@ q.tsq
      )
      and (p_document_title is null or d.title ilike '%' || p_document_title || '%')
    group by d.id, d.title, q.tsq
  )
  select
    scored.document_id,
    scored.document_title,
    scored.summary_block,
    row_number() over (order by lexical_score desc, document_title asc, document_id asc) as rank
  from scored
  where lexical_score > 0
  order by lexical_score desc, document_title asc, document_id asc
  limit p_limit;
$$;

grant execute on function public.fast_search_vector_candidates(uuid, public.vector, text, text, boolean, integer, integer, integer) to authenticated;
grant execute on function public.fast_search_lexical_candidates(uuid, text, text, text, boolean, integer, integer, integer) to authenticated;
grant execute on function public.fast_search_document_candidates(uuid, text, text, integer) to authenticated;
