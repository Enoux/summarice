-- Drop old signature to avoid ambiguity
drop function if exists public.create_highlight(uuid, text, integer, text, jsonb, smallint, text, text, text);

-- Extend create_highlight RPC to accept optional p_id for optimistic UI
create or replace function public.create_highlight(
  p_document_id uuid,
  p_kind text,
  p_page_number integer,
  p_text text,
  p_bounding_box jsonb,
  p_category smallint,
  p_color text,
  p_comment text default null,
  p_screenshot_path text default null,
  p_id uuid default null          -- new optional param
) returns public.highlights
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
  r public.highlights;
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

  if p_kind not in ('text', 'area') then
    raise exception 'invalid kind';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_document_id::text));

  select coalesce(max(ordinal), 0) + 1 into v_next
  from public.highlights
  where document_id = p_document_id;

  insert into public.highlights (
    id,                             -- use supplied id or gen_random_uuid()
    document_id,
    owner_id,
    ordinal,
    kind,
    page_number,
    text,
    comment,
    screenshot_path,
    bounding_box,
    category,
    color
  )
  values (
    COALESCE(p_id, gen_random_uuid()),
    p_document_id,
    auth.uid(),
    v_next,
    p_kind,
    p_page_number,
    p_text,
    nullif(trim(p_comment), ''),
    p_screenshot_path,
    p_bounding_box,
    p_category,
    p_color
  )
  returning * into r;

  return r;
end;
$$;

-- Update revoke/grant for the new signature
revoke all on function public.create_highlight(uuid, text, integer, text, jsonb, smallint, text, text, text, uuid) from public;
grant execute on function public.create_highlight(uuid, text, integer, text, jsonb, smallint, text, text, text, uuid) to authenticated;
