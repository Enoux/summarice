# `server/ai/`

The **AI Provider Port**. All model calls go through here — no direct `fetch()` to model APIs from other modules.

## What goes here

- A thin port interface (`generate`, `embed`, `vision`, `stream`) that hides provider-specific details.
- Adapters for **OpenRouter** (bridging to **Gemini 3 Flash** for generation/vision and **OpenAI** for embeddings).
- Telemetry integration via `llm_calls` table tracking tokens, latency, and cost.
- Stream normalization ensuring uniform chunk shapes across different models.

## Status

**🟢 Operational**. The provider is used for figure interpretation and is ready for summary generation and deep chat features.

