# `server/ingestion/`

PDF upload pipeline. Turns a raw PDF into rows the rest of the app can use.

## What goes here

- File upload handler: persist PDF to Supabase Storage under a user-scoped path.
- Page text extraction (via `pdf-lib` or `pdfjs-dist`).
- Outline extraction (table of contents).
- **Text-density scan** — reject scanned PDFs that are mostly image with no extractable text (PRD constraint).
- Writes to `documents` and `document_pages` tables.

## Flow

```
upload → store file → extract text + outline → density scan → write rows → ready
```

Currently `.gitkeep`-only. Implementation lands in **Issues 02–04**.

