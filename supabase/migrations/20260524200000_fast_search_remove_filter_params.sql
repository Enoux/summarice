-- Fast library search: remove server-side filter params (chips filter client-side).

drop function if exists public.fast_search_vector_candidates(uuid, public.vector, text, text, boolean, integer, integer, integer);

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
  where p.owner_id = p_owner_id
    and he.status = 'success'
    and he.embedding is not null
  order by he.embedding <=> p_query_embedding
  limit p_limit;
$$;

drop function if exists public.fast_search_direct_candidates(uuid, text, text, text, boolean, integer, integer, text[], text[], integer);

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
      nullif(p.annotation_preview, '') as annotation_preview,
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
    scored.annotation_preview,
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

drop function if exists public.fast_search_summary_candidates(uuid, text, text, text, boolean, integer, integer, text[], text[], integer);

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
      nullif(p.annotation_preview, '') as annotation_preview,
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
    scored.annotation_preview,
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

drop function if exists public.fast_search_document_candidates(uuid, text, text, text[], text[], integer);

create or replace function public.fast_search_document_candidates(
  p_owner_id uuid,
  p_text_query text,
  p_partial_terms text[],
  p_partial_excluded text[],
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
      end as tsq,
      0.05::double precision as partial_score
  ),
  document_blocks as (
    select
      d.id as document_id,
      d.title as document_title,
      lower(d.title) as title_corpus,
      coalesce(string_agg(lower(sb.block_text), ' ' order by sb.summary_id, sb.block_index), '') as blocks_corpus
    from public.documents d
    left join public.fast_search_summary_block_projection sb
      on sb.document_id = d.id
     and sb.owner_id = d.owner_id
    where d.owner_id = p_owner_id
    group by d.id, d.title
  ),
  scored as (
    select
      db.document_id,
      db.document_title,
      coalesce(
        max(sb.block_text) filter (where q.tsq is not null and sb.search_tsvector @@ q.tsq),
        db.document_title
      ) as summary_block,
      greatest(
        case
          when q.tsq is not null and to_tsvector('english', db.document_title) @@ q.tsq
            then ts_rank(to_tsvector('english', db.document_title), q.tsq)
          else 0
        end,
        coalesce(
          max(ts_rank(sb.search_tsvector, q.tsq)) filter (
            where q.tsq is not null and sb.search_tsvector @@ q.tsq
          ),
          0
        ),
        case
          when public.corpus_matches_partial(
            db.title_corpus || ' ' || db.blocks_corpus,
            p_partial_terms,
            p_partial_excluded
          ) then q.partial_score
          else 0
        end
      ) as lexical_score
    from document_blocks db
    join query q on true
    left join public.fast_search_summary_block_projection sb
      on sb.document_id = db.document_id
     and sb.owner_id = p_owner_id
    where (
      (q.tsq is not null and (
        to_tsvector('english', db.document_title) @@ q.tsq
        or sb.search_tsvector @@ q.tsq
      ))
      or public.corpus_matches_partial(
        db.title_corpus || ' ' || db.blocks_corpus,
        p_partial_terms,
        p_partial_excluded
      )
    )
    group by db.document_id, db.document_title, db.title_corpus, db.blocks_corpus, q.tsq, q.partial_score
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

drop function if exists public.fast_search_lexical_candidates(uuid, text, text, text, boolean, integer, integer, text[], text[], integer);

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
      nullif(p.annotation_preview, '') as annotation_preview,
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
      nullif(p.annotation_preview, '') as annotation_preview,
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

grant execute on function public.fast_search_vector_candidates(uuid, public.vector, integer) to authenticated;

grant execute on function public.fast_search_direct_candidates(
  uuid, text, text[], text[], integer
) to authenticated;

grant execute on function public.fast_search_summary_candidates(
  uuid, text, text[], text[], integer
) to authenticated;

grant execute on function public.fast_search_document_candidates(
  uuid, text, text[], text[], integer
) to authenticated;

grant execute on function public.fast_search_lexical_candidates(
  uuid, text, text[], text[], integer
) to authenticated;
