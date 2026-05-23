-- Fast library search: expose comment and AI-only annotation preview for subtitle rendering.

alter table public.fast_search_highlight_projection
  add column if not exists ai_annotation_preview text;

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
    ai_annotation_preview,
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
    left(coalesce(ar.ai_annotation_preview, ''), 240),
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
    select
      string_agg(a.body, ' ' order by a.created_at) as annotation_preview,
      string_agg(a.body, ' ' order by a.created_at) filter (where a.source = 'ai') as ai_annotation_preview
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
    ai_annotation_preview = excluded.ai_annotation_preview,
    color = excluded.color,
    category = excluded.category,
    search_tsvector = excluded.search_tsvector,
    updated_at = excluded.updated_at;
$$;

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
  ai_annotation_preview,
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
  left(coalesce(ar.ai_annotation_preview, ''), 240),
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
  select
    string_agg(a.body, ' ' order by a.created_at) as annotation_preview,
    string_agg(a.body, ' ' order by a.created_at) filter (where a.source = 'ai') as ai_annotation_preview
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
  ai_annotation_preview = excluded.ai_annotation_preview,
  color = excluded.color,
  category = excluded.category,
  search_tsvector = excluded.search_tsvector,
  updated_at = excluded.updated_at;

drop function if exists public.fast_search_vector_candidates(uuid, public.vector, integer);

create or replace function public.fast_search_vector_candidates(
  p_owner_id uuid,
  p_query_embedding public.vector,
  p_limit integer
) returns table (
  highlight_id uuid,
  document_id uuid,
  document_title text,
  page_number integer,
  kind text,
  text text,
  comment text,
  annotation_preview text,
  ai_annotation_preview text,
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
  select
    p.highlight_id,
    p.document_id,
    p.document_title,
    p.page_number,
    p.kind,
    p.text,
    nullif(p.comment, '') as comment,
    nullif(p.annotation_preview, '') as annotation_preview,
    nullif(p.ai_annotation_preview, '') as ai_annotation_preview,
    p.color,
    he.embedding,
    'direct'::text as source,
    null::text as summary_block,
    1 - (he.embedding <=> p_query_embedding) as similarity,
    row_number() over (order by he.embedding <=> p_query_embedding) as rank
  from public.highlight_embeddings he
  join public.fast_search_highlight_projection p on p.highlight_id = he.highlight_id
  where p.owner_id = p_owner_id
    and he.status = 'success'
    and he.embedding is not null
  order by he.embedding <=> p_query_embedding
  limit p_limit;
$$;

drop function if exists public.fast_search_direct_candidates(uuid, text, text[], text[], integer);

create or replace function public.fast_search_direct_candidates(
  p_owner_id uuid,
  p_text_query text,
  p_partial_terms text[],
  p_partial_excluded text[],
  p_limit integer
) returns table (
  highlight_id uuid,
  document_id uuid,
  document_title text,
  page_number integer,
  kind text,
  text text,
  comment text,
  annotation_preview text,
  ai_annotation_preview text,
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
      end as tsq,
      0.05::double precision as partial_score
  ),
  scored as (
    select
      p.highlight_id,
      p.document_id,
      p.document_title,
      p.page_number,
      p.kind,
      p.text,
      nullif(p.comment, '') as comment,
      nullif(p.annotation_preview, '') as annotation_preview,
      nullif(p.ai_annotation_preview, '') as ai_annotation_preview,
      p.color,
      null::public.vector as embedding,
      'direct'::text as source,
      null::text as summary_block,
      null::double precision as similarity,
      greatest(
        case
          when q.tsq is null then 1
          when p.search_tsvector @@ q.tsq then ts_rank(p.search_tsvector, q.tsq)
          else 0
        end,
        case
          when public.corpus_matches_partial(
            lower(
              trim(
                coalesce(p.text, '') || ' ' ||
                coalesce(p.comment, '') || ' ' ||
                coalesce(p.annotation_preview, '')
              )
            ),
            p_partial_terms,
            p_partial_excluded
          ) then q.partial_score
          else 0
        end
      ) as lexical_score
    from public.fast_search_highlight_projection p
    join query q on true
    where p.owner_id = p_owner_id
  )
  select
    scored.highlight_id,
    scored.document_id,
    scored.document_title,
    scored.page_number,
    scored.kind,
    scored.text,
    scored.comment,
    scored.annotation_preview,
    scored.ai_annotation_preview,
    scored.color,
    scored.embedding,
    scored.source,
    scored.summary_block,
    scored.similarity,
    row_number() over (order by lexical_score desc, page_number asc, highlight_id asc) as rank
  from scored
  where lexical_score > 0
  order by lexical_score desc, page_number asc, highlight_id asc
  limit p_limit;
$$;

drop function if exists public.fast_search_summary_candidates(uuid, text, text[], text[], integer);

create or replace function public.fast_search_summary_candidates(
  p_owner_id uuid,
  p_text_query text,
  p_partial_terms text[],
  p_partial_excluded text[],
  p_limit integer
) returns table (
  highlight_id uuid,
  document_id uuid,
  document_title text,
  page_number integer,
  kind text,
  text text,
  comment text,
  annotation_preview text,
  ai_annotation_preview text,
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
      end as tsq,
      0.05::double precision as partial_score
  ),
  summary_matches as (
    select
      sc.highlight_id,
      greatest(
        coalesce(
          max(ts_rank(sb.search_tsvector, q.tsq)) filter (
            where q.tsq is not null and sb.search_tsvector @@ q.tsq
          ),
          0
        ),
        case
          when bool_or(
            public.corpus_matches_partial(lower(sb.block_text), p_partial_terms, p_partial_excluded)
          )
            then q.partial_score
          else 0
        end
      ) as summary_rank,
      max(sb.block_text) as summary_block
    from public.fast_search_summary_block_projection sb
    join query q on true
    join lateral unnest(sb.citation_ordinals) as citation(ordinal) on true
    join public.summary_citations sc
      on sc.summary_id = sb.summary_id
     and sc.ordinal = citation.ordinal
    where sb.owner_id = p_owner_id
      and sc.highlight_id is not null
      and (
        (q.tsq is not null and sb.search_tsvector @@ q.tsq)
        or public.corpus_matches_partial(lower(sb.block_text), p_partial_terms, p_partial_excluded)
      )
    group by sc.highlight_id, q.partial_score
  ),
  scored as (
    select
      p.highlight_id,
      p.document_id,
      p.document_title,
      p.page_number,
      p.kind,
      p.text,
      nullif(p.comment, '') as comment,
      nullif(p.annotation_preview, '') as annotation_preview,
      nullif(p.ai_annotation_preview, '') as ai_annotation_preview,
      p.color,
      null::public.vector as embedding,
      'summary'::text as source,
      sm.summary_block,
      null::double precision as similarity,
      sm.summary_rank as lexical_score
    from summary_matches sm
    join public.fast_search_highlight_projection p on p.highlight_id = sm.highlight_id
    where p.owner_id = p_owner_id
      and sm.summary_rank > 0
  )
  select
    scored.highlight_id,
    scored.document_id,
    scored.document_title,
    scored.page_number,
    scored.kind,
    scored.text,
    scored.comment,
    scored.annotation_preview,
    scored.ai_annotation_preview,
    scored.color,
    scored.embedding,
    scored.source,
    scored.summary_block,
    scored.similarity,
    row_number() over (order by lexical_score desc, page_number asc, highlight_id asc) as rank
  from scored
  where lexical_score > 0
  order by lexical_score desc, page_number asc, highlight_id asc
  limit p_limit;
$$;

drop function if exists public.fast_search_lexical_candidates(uuid, text, text[], text[], integer);

create or replace function public.fast_search_lexical_candidates(
  p_owner_id uuid,
  p_text_query text,
  p_partial_terms text[],
  p_partial_excluded text[],
  p_limit integer
) returns table (
  highlight_id uuid,
  document_id uuid,
  document_title text,
  page_number integer,
  kind text,
  text text,
  comment text,
  annotation_preview text,
  ai_annotation_preview text,
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
      end as tsq,
      0.05::double precision as partial_score
  ),
  summary_matches as (
    select
      sc.highlight_id,
      greatest(
        coalesce(
          max(ts_rank(sb.search_tsvector, q.tsq)) filter (
            where q.tsq is not null and sb.search_tsvector @@ q.tsq
          ),
          0
        ),
        case
          when bool_or(
            public.corpus_matches_partial(lower(sb.block_text), p_partial_terms, p_partial_excluded)
          )
            then q.partial_score
          else 0
        end
      ) as summary_rank,
      max(sb.block_text) as summary_block
    from public.fast_search_summary_block_projection sb
    join query q on true
    join lateral unnest(sb.citation_ordinals) as citation(ordinal) on true
    join public.summary_citations sc
      on sc.summary_id = sb.summary_id
     and sc.ordinal = citation.ordinal
    where sb.owner_id = p_owner_id
      and sc.highlight_id is not null
      and (
        (q.tsq is not null and sb.search_tsvector @@ q.tsq)
        or public.corpus_matches_partial(lower(sb.block_text), p_partial_terms, p_partial_excluded)
      )
    group by sc.highlight_id, q.partial_score
  ),
  direct_scored as (
    select
      p.highlight_id,
      p.document_id,
      p.document_title,
      p.page_number,
      p.kind,
      p.text,
      nullif(p.comment, '') as comment,
      nullif(p.annotation_preview, '') as annotation_preview,
      nullif(p.ai_annotation_preview, '') as ai_annotation_preview,
      p.color,
      he.embedding,
      'direct'::text as source,
      null::text as summary_block,
      greatest(
        case
          when q.tsq is null then 1
          when p.search_tsvector @@ q.tsq then ts_rank(p.search_tsvector, q.tsq)
          else 0
        end,
        case
          when public.corpus_matches_partial(
            lower(
              trim(
                coalesce(p.text, '') || ' ' ||
                coalesce(p.comment, '') || ' ' ||
                coalesce(p.annotation_preview, '')
              )
            ),
            p_partial_terms,
            p_partial_excluded
          ) then q.partial_score
          else 0
        end
      ) as lexical_score
    from public.fast_search_highlight_projection p
    join query q on true
    left join public.highlight_embeddings he
      on he.highlight_id = p.highlight_id
     and he.status = 'success'
    where p.owner_id = p_owner_id
  ),
  summary_scored as (
    select
      p.highlight_id,
      p.document_id,
      p.document_title,
      p.page_number,
      p.kind,
      p.text,
      nullif(p.comment, '') as comment,
      nullif(p.annotation_preview, '') as annotation_preview,
      nullif(p.ai_annotation_preview, '') as ai_annotation_preview,
      p.color,
      he.embedding,
      'summary'::text as source,
      sm.summary_block,
      sm.summary_rank as lexical_score
    from summary_matches sm
    join public.fast_search_highlight_projection p on p.highlight_id = sm.highlight_id
    left join public.highlight_embeddings he
      on he.highlight_id = p.highlight_id
     and he.status = 'success'
    where p.owner_id = p_owner_id
      and sm.summary_rank > 0
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
      scored.comment,
      scored.annotation_preview,
      scored.ai_annotation_preview,
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

grant execute on function public.fast_search_vector_candidates(uuid, public.vector, integer) to authenticated;

grant execute on function public.fast_search_direct_candidates(
  uuid, text, text[], text[], integer
) to authenticated;

grant execute on function public.fast_search_summary_candidates(
  uuid, text, text[], text[], integer
) to authenticated;

grant execute on function public.fast_search_lexical_candidates(
  uuid, text, text[], text[], integer
) to authenticated;
