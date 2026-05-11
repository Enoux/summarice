# Cascade delete verification (manual checklist)

Use against a dev Supabase project with **Storage** buckets `documents` and `highlight-screenshots` enabled.

## Document delete (library)

1. Upload a PDF with highlights and summaries if available.
2. Add at least one **area** highlight (screenshot stored).
3. In the library, delete the document and confirm success (or check the surfaced error).
4. **Postgres**: `documents` row gone; related `document_pages`, `highlights`, `annotations`, `summaries` removed via FK cascades.
5. **Storage**: PDF object at `documents.storage_path` removed; objects under document’s highlight screenshots in `highlight-screenshots` removed (paths collected before row delete).
6. If storage cleanup fails, response may include `warnings` and the browser console logs them.

## Highlight delete (viewer)

1. Open a document; create a **text** highlight and an **area** highlight (with annotation thread optional).
2. Delete the **area** highlight.
3. **Postgres**: highlight row and its `annotations` / `highlight_embeddings` rows removed (cascade).
4. **Storage**: `highlights.screenshot_path` object removed from `highlight-screenshots`.
5. Delete a **text** highlight: no screenshot path; storage remove is a no-op.

## Annotation delete

1. Add a human annotation on a highlight.
2. Delete the annotation from the UI.
3. Expect `404` if the annotation id does not belong to the current document URL (server scope check).

## Automated coverage

- `src/lib/server/document-upload/delete-document.test.ts`
- `src/lib/server/highlights/highlight-service-delete.test.ts`
- `src/routes/(app)/doc/[id]/highlights/highlights-delete.test.ts`
