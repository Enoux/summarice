# `server/ingestion/`

PDF upload pipeline. Turns a raw PDF into rows the rest of the app can use.

## Current Status

The core ingestion logic is currently implemented in `$lib/ingestion/index.ts`. It handles:
- File upload to Supabase Storage.
- Page text extraction via `pdfjs-dist`.
- Outline extraction (table of contents).
- **Text-density scan** — rejects scanned PDFs that are mostly image.
- Database persistence via the `ingest_document` RPC.

## Future Plans

- Server-side OCR for scanned PDFs.
- More robust metadata extraction.
- Automatic document classification.

