# `server/figures/`

Figure interpreter. Extracts figure regions from PDFs and asks the AI provider to describe them.

## Status

**🟢 Operational**. 
- Integrated with `area` highlights in the PDF viewer.
- Uses multimodal vision calls (Gemini 3 Flash via OpenRouter).
- Supports re-explanation and manual editing of AI-generated interpretations.
- Telemetry is recorded to `llm_calls` for cost and performance tracking.

