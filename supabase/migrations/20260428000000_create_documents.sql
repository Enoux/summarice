-- Create documents table
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  page_count integer not null,
  has_text_layer boolean not null default true,
  outline jsonb default '[]'::jsonb,
  storage_path text not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.documents enable row level security;

-- Policies for documents
create policy "Users can view their own documents"
  on public.documents for select
  using (auth.uid() = owner_id);

create policy "Users can insert their own documents"
  on public.documents for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own documents"
  on public.documents for update
  using (auth.uid() = owner_id);

create policy "Users can delete their own documents"
  on public.documents for delete
  using (auth.uid() = owner_id);

-- Create document_pages table
create table public.document_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  page_number integer not null,
  text text not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.document_pages enable row level security;

-- Policies for document_pages
create policy "Users can view pages of their own documents"
  on public.document_pages for select
  using (
    exists (
      select 1 from public.documents
      where documents.id = document_pages.document_id
      and documents.owner_id = auth.uid()
    )
  );

create policy "Users can insert pages for their own documents"
  on public.document_pages for insert
  with check (
    exists (
      select 1 from public.documents
      where documents.id = document_pages.document_id
      and documents.owner_id = auth.uid()
    )
  );

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage policies
create policy "Users can upload their own documents"
  on storage.objects for insert
  with check (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view their own documents"
  on storage.objects for select
  using (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own documents"
  on storage.objects for delete
  using (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- RPC for transactional ingestion
create or replace function public.ingest_document(
  p_title text,
  p_page_count integer,
  p_has_text_layer boolean,
  p_outline jsonb,
  p_storage_path text,
  p_pages jsonb -- Array of {page_number, text}
) returns uuid as $$
declare
  v_document_id uuid;
  v_page jsonb;
begin
  -- Validate page count
  if jsonb_array_length(p_pages) != p_page_count then
    raise exception 'Page count mismatch: expected %, got %', p_page_count, jsonb_array_length(p_pages);
  end if;

  -- Insert document
  insert into public.documents (owner_id, title, page_count, has_text_layer, outline, storage_path)
  values (auth.uid(), p_title, p_page_count, p_has_text_layer, p_outline, p_storage_path)
  returning id into v_document_id;

  -- Insert pages
  for v_page in select * from jsonb_array_elements(p_pages)
  loop
    insert into public.document_pages (document_id, page_number, text)
    values (v_document_id, (v_page->>'page_number')::integer, v_page->>'text');
  end loop;

  return v_document_id;
end;
$$ language plpgsql security definer;
