# `server/summary/`

Summary generator. Produces a versioned, citation-bearing markdown summary for a document.

## What goes here

- Prompt builder that assembles document text + highlights + annotations + page contexts into a structured prompt.
- The orchestration that calls `server/ai` (Gemini), streams chunks back to the route, and writes the final summary to Postgres.
- Citation ordinal **whitelist validation** — the model can only cite ordinals from the highlight set we sent it; out-of-range citations are rejected (uses `lib/citations/` for parsing).
- Versioning logic: each generation produces a new row in `summaries`, with `summary_citations` linking to the source highlights.

Currently `.gitkeep`-only. Implementation lands in **Issue 07**.

