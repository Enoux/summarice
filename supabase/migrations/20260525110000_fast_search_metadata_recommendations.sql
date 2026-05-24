alter table public.highlights
  add column if not exists updated_at timestamptz;

update public.highlights
set updated_at = created_at
where updated_at is null;

alter table public.highlights
  alter column updated_at set default now(),
  alter column updated_at set not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists highlights_set_updated_at on public.highlights;

create trigger highlights_set_updated_at
  before update
  on public.highlights
  for each row
  execute function public.set_updated_at();

alter table public.annotations
  add column if not exists updated_at timestamptz;

update public.annotations
set updated_at = created_at
where updated_at is null;

alter table public.annotations
  alter column updated_at set default now(),
  alter column updated_at set not null;

drop trigger if exists annotations_set_updated_at on public.annotations;

create trigger annotations_set_updated_at
  before update
  on public.annotations
  for each row
  execute function public.set_updated_at();

create index if not exists highlights_owner_activity_idx
  on public.highlights (owner_id, updated_at desc, created_at desc);

create index if not exists annotations_highlight_updated_at_idx
  on public.annotations (highlight_id, updated_at desc);

drop function if exists public.fast_search_document_candidates(uuid, text, text[], text[], integer);

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
  tags text[],
  entities text[],
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
  current_summaries as (
    select
      s.document_id,
      s.tags,
      s.entities,
      s.generated_tsvector
    from public.summaries s
    where s.owner_id = p_owner_id
      and s.is_current
  ),
  document_blocks as (
    select
      d.id as document_id,
      d.title as document_title,
      coalesce(cs.tags, '{}'::text[]) as tags,
      coalesce(cs.entities, '{}'::text[]) as entities,
      lower(d.title) as title_corpus,
      lower(array_to_string(coalesce(cs.tags, '{}'::text[]) || coalesce(cs.entities, '{}'::text[]), ' ')) as metadata_corpus,
      coalesce(string_agg(lower(sb.block_text), ' ' order by sb.summary_id, sb.block_index), '') as blocks_corpus
    from public.documents d
    left join current_summaries cs on cs.document_id = d.id
    left join public.fast_search_summary_block_projection sb
      on sb.document_id = d.id
     and sb.owner_id = d.owner_id
    where d.owner_id = p_owner_id
    group by d.id, d.title, cs.tags, cs.entities
  ),
  scored as (
    select
      db.document_id,
      db.document_title,
      coalesce(
        max(sb.block_text) filter (where q.tsq is not null and sb.search_tsvector @@ q.tsq),
        db.document_title
      ) as summary_block,
      db.tags,
      db.entities,
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
        coalesce(
          max(ts_rank(cs.generated_tsvector, q.tsq)) filter (
            where q.tsq is not null and cs.generated_tsvector @@ q.tsq
          ),
          0
        ),
        case
          when public.corpus_matches_partial(
            db.title_corpus || ' ' || db.blocks_corpus || ' ' || db.metadata_corpus,
            p_partial_terms,
            p_partial_excluded
          ) then q.partial_score
          else 0
        end
      ) as lexical_score
    from document_blocks db
    join query q on true
    left join current_summaries cs on cs.document_id = db.document_id
    left join public.fast_search_summary_block_projection sb
      on sb.document_id = db.document_id
     and sb.owner_id = p_owner_id
    where (
      (q.tsq is not null and (
        to_tsvector('english', db.document_title) @@ q.tsq
        or sb.search_tsvector @@ q.tsq
        or cs.generated_tsvector @@ q.tsq
      ))
      or public.corpus_matches_partial(
        db.title_corpus || ' ' || db.blocks_corpus || ' ' || db.metadata_corpus,
        p_partial_terms,
        p_partial_excluded
      )
    )
    group by db.document_id, db.document_title, db.tags, db.entities, db.title_corpus, db.blocks_corpus, db.metadata_corpus, q.tsq, q.partial_score
  )
  select
    scored.document_id,
    scored.document_title,
    scored.summary_block,
    scored.tags,
    scored.entities,
    row_number() over (order by lexical_score desc, document_title asc, document_id asc) as rank
  from scored
  where lexical_score > 0
  order by lexical_score desc, document_title asc, document_id asc
  limit p_limit;
$$;

create or replace function public.fast_search_recommended_candidates(
  p_owner_id uuid,
  p_current_document_id uuid,
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
  with activity as (
    select
      p.highlight_id,
      greatest(
        h.created_at,
        h.updated_at,
        coalesce(max(a.updated_at), h.created_at)
      ) as activity_at
    from public.fast_search_highlight_projection p
    join public.highlights h on h.id = p.highlight_id
    left join public.annotations a
      on a.highlight_id = p.highlight_id
     and a.owner_id = p.owner_id
    where p.owner_id = p_owner_id
      and (p_current_document_id is null or p.document_id <> p_current_document_id)
    group by p.highlight_id, h.created_at, h.updated_at
  ),
  ranked as (
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
      row_number() over (order by activity.activity_at desc, p.page_number asc, p.highlight_id asc) as rank
    from activity
    join public.fast_search_highlight_projection p on p.highlight_id = activity.highlight_id
    order by activity.activity_at desc, p.page_number asc, p.highlight_id asc
    limit p_limit
  )
  select * from ranked;
$$;

grant execute on function public.fast_search_document_candidates(
  uuid, text, text[], text[], integer
) to authenticated;

grant execute on function public.fast_search_recommended_candidates(
  uuid, uuid, integer
) to authenticated;
