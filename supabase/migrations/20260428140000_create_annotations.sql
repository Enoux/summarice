-- Create annotations table
create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  highlight_id uuid not null references public.highlights (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  source text not null check (source in ('human', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.annotations enable row level security;

-- Policies
create policy "Users can view own annotations"
  on public.annotations for select
  using (auth.uid() = owner_id);

create policy "Users can insert own annotations"
  on public.annotations for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own annotations"
  on public.annotations for update
  using (auth.uid() = owner_id);

create policy "Users can delete own annotations"
  on public.annotations for delete
  using (auth.uid() = owner_id);

-- Index for performance
create index annotations_highlight_id_idx on public.annotations (highlight_id);

-- Trigger for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_annotations_updated_at
  before update on public.annotations
  for each row
  execute function public.handle_updated_at();
