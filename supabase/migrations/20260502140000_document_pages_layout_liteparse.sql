alter table public.document_pages
add column if not exists layout jsonb;

create or replace function public.ingest_document(
  p_title text,
  p_page_count integer,
  p_has_text_layer boolean,
  p_outline jsonb,
  p_storage_path text,
  p_pages jsonb
) returns uuid as $$
declare
  v_document_id uuid;
  v_page jsonb;
begin
  if jsonb_array_length(p_pages) != p_page_count then
    raise exception 'Page count mismatch: expected %, got %', p_page_count, jsonb_array_length(p_pages);
  end if;

  insert into public.documents (owner_id, title, page_count, has_text_layer, outline, storage_path)
  values (auth.uid(), p_title, p_page_count, p_has_text_layer, p_outline, p_storage_path)
  returning id into v_document_id;

  for v_page in select * from jsonb_array_elements(p_pages)
  loop
    insert into public.document_pages (document_id, page_number, text, layout)
    values (
      v_document_id,
      (v_page->>'page_number')::integer,
      coalesce(v_page->>'text', ''),
      v_page->'layout'
    );
  end loop;

  return v_document_id;
end;
$$ language plpgsql security definer;
