# 📝 Summary Generator (`src/lib/server/summary/`)

The Summary Generator is the intelligent engine that reads a document—alongside a user's specific highlights and notes—and produces a versioned, citation-bearing Markdown summary.

## 🏗️ Architecture & Pipeline

This module orchestrates the complex flow from raw data to a finished summary:

1. **Prompt Engineering:** It features a sophisticated prompt builder that gathers document text, user highlights, personal annotations, and page contexts, assembling them into a highly structured prompt for the AI model.
2. **AI Orchestration & Streaming:** It calls the `server/ai/` port to generate the summary, streaming the response chunks back to the client in real-time for a responsive UX, before finally saving the complete summary to Postgres.
3. **Citation Validation (Whitelist):** To prevent AI hallucinations, it enforces strict citation rules. The model is only allowed to cite ordinal numbers corresponding to the specific highlights we provided. Any out-of-range or invented citations are actively rejected.
4. **Versioning:** Summaries are immutable. Each new generation produces a fresh row in the `summaries` table, utilizing `summary_citations` to maintain exact links back to the source highlights.

## 🚥 Status

**🟢 Operational**. 
- Fully integrated with real-time summary streaming in the document viewer.
- Reliably enforcing citation validation and cross-linking to user highlights.
- Generation telemetry is properly recorded to `llm_calls`.
