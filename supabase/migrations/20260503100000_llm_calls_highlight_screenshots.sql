-- OpenRouter AI SDK figure interpretation telemetry + private highlight screenshots.

alter table public.highlights
  add column if not exists screenshot_path text;

create table public.llm_calls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  highlight_id uuid references public.highlights (id) on delete set null,
  annotation_id uuid references public.annotations (id) on delete set null,
  provider text not null default 'openrouter',
  model text not null,
  use_case text not null default 'figure_interpretation',
  status text not null check (status in ('completed', 'failed')),
  prompt_tokens integer check (prompt_tokens is null or prompt_tokens >= 0),
  completion_tokens integer check (completion_tokens is null or completion_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  cost_usd numeric(12, 6) check (cost_usd is null or cost_usd >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_message text,
  usage jsonb,
  provider_metadata jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  constraint llm_calls_total_tokens_consistent
    check (
      total_tokens is null
      or prompt_tokens is null
      or completion_tokens is null
      or total_tokens = prompt_tokens + completion_tokens
    )
);

create or replace function public.validate_llm_call_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.document_id is not null and not exists (
    select 1 from public.documents d
    where d.id = new.document_id and d.owner_id = new.owner_id
  ) then
    raise exception 'document not found for owner';
  end if;

  if new.highlight_id is not null and not exists (
    select 1 from public.highlights h
    where h.id = new.highlight_id and h.owner_id = new.owner_id
  ) then
    raise exception 'highlight not found for owner';
  end if;

  if new.document_id is not null and new.highlight_id is not null and not exists (
    select 1 from public.highlights h
    where h.id = new.highlight_id and h.document_id = new.document_id
  ) then
    raise exception 'highlight does not belong to document';
  end if;

  return new;
end;
$$;

create trigger validate_llm_call_owner
  before insert or update of owner_id, document_id, highlight_id
  on public.llm_calls
  for each row
  execute function public.validate_llm_call_owner();

create index llm_calls_owner_id_created_at_idx
  on public.llm_calls (owner_id, created_at desc);

create index llm_calls_document_id_idx
  on public.llm_calls (document_id);

create index llm_calls_highlight_id_idx
  on public.llm_calls (highlight_id);

alter table public.llm_calls enable row level security;

create policy "Users can view own llm calls"
  on public.llm_calls for select
  using (auth.uid() = owner_id);

create policy "Server can insert own llm calls"
  on public.llm_calls for insert
  with check (auth.role() = 'service_role' or auth.uid() = owner_id);

create policy "Server can update own llm calls"
  on public.llm_calls for update
  using (auth.role() = 'service_role' or auth.uid() = owner_id)
  with check (auth.role() = 'service_role' or auth.uid() = owner_id);

insert into storage.buckets (id, name, public)
values ('highlight-screenshots', 'highlight-screenshots', false)
on conflict (id) do nothing;

create policy "Users can upload own highlight screenshots"
  on storage.objects for insert
  with check (
    bucket_id = 'highlight-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view own highlight screenshots"
  on storage.objects for select
  using (
    bucket_id = 'highlight-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own highlight screenshots"
  on storage.objects for update
  using (
    bucket_id = 'highlight-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'highlight-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own highlight screenshots"
  on storage.objects for delete
  using (
    bucket_id = 'highlight-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
