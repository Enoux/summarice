-- Migration: generate_summary_finalize no longer raises when a cited ordinal has no
-- matching live highlight. Instead it inserts the citation row with highlight_id = NULL
-- so the rendering layer can grey it out (Decision F4 / issue-08).
--
-- DO NOT edit 20260504110000_summaries_generate_finalize.sql; this migration
-- replaces only the finalize function behaviour.

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

  -- LEFT JOIN: citations whose ordinal no longer maps to a live highlight get
  -- highlight_id = NULL rather than being dropped or raising an exception.
  -- This preserves deleted-highlight citations so the UI can grey them out.
  insert into public.summary_citations (
    summary_id,
    highlight_id,
    ordinal,
    occurrence_index
  )
  select
    v_summary.id,
    h.id,         -- NULL when no matching highlight exists
    pc.ordinal,
    pc.occurrence_index
  from (
    select
      (value->>'ordinal')::integer as ordinal,
      (value->>'occurrenceIndex')::integer as occurrence_index
    from jsonb_array_elements(p_citations)
  ) pc
  left join public.highlights h
    on h.document_id = p_document_id
   and h.ordinal = pc.ordinal;

  return v_summary;
end;
$$;

revoke all on function public.generate_summary_finalize(uuid, text, text[], text[], text[], text, integer, integer, jsonb) from public;
grant execute on function public.generate_summary_finalize(uuid, text, text[], text[], text[], text, integer, integer, jsonb) to authenticated;
