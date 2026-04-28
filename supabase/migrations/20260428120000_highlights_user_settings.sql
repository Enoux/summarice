-- Highlights + per-user settings. Area screenshot storage deferred (#19).

create table public.user_settings (
  id uuid primary key references auth.users (id) on delete cascade,
  category_labels jsonb not null default '{
    "1": "Key idea",
    "2": "Definition",
    "3": "Evidence",
    "4": "Question",
    "5": "Contradiction"
  }'::jsonb,
  use_colors_decoratively boolean not null default false,
  decorative_default_color text,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users can read own settings"
  on public.user_settings for select
  using (auth.uid() = id);

create policy "Users can insert own settings"
  on public.user_settings for insert
  with check (auth.uid() = id);

create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = id);

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  ordinal integer not null,
  kind text not null check (kind in ('text', 'area')),
  page_number integer not null,
  text text,
  comment text,
  screenshot_path text,
  bounding_box jsonb not null,
  category smallint check (category is null or (category >= 1 and category <= 5)),
  color text not null,
  created_at timestamptz not null default now(),
  unique (document_id, ordinal)
);

create index highlights_document_id_idx on public.highlights (document_id);
create index highlights_owner_id_idx on public.highlights (owner_id);

alter table public.highlights enable row level security;

create policy "Users can view own highlights"
  on public.highlights for select
  using (auth.uid() = owner_id);

create policy "Users can insert own highlights"
  on public.highlights for insert
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.owner_id = auth.uid()
    )
  );

create policy "Users can update own highlights"
  on public.highlights for update
  using (auth.uid() = owner_id);

create policy "Users can delete own highlights"
  on public.highlights for delete
  using (auth.uid() = owner_id);

-- Atomic ordinal assignment + ownership check (SECURITY DEFINER; RLS still applies to direct table access)
create or replace function public.create_highlight(
  p_document_id uuid,
  p_kind text,
  p_page_number integer,
  p_text text,
  p_bounding_box jsonb,
  p_category smallint,
  p_color text,
  p_comment text default null,
  p_screenshot_path text default null
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

revoke all on function public.create_highlight(uuid, text, integer, text, jsonb, smallint, text, text, text) from public;
grant execute on function public.create_highlight(uuid, text, integer, text, jsonb, smallint, text, text, text) to authenticated;
