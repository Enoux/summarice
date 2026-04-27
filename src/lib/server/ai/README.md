# `server/ai/`

The **AI Provider Port**. All model calls go through here — no direct `fetch()` to model APIs from other modules.

## What goes here

- A thin port interface (`generate`, `embed`, `stream`) that hides provider-specific details.
- Adapters for **Gemini 2.5 Flash** (text generation, structured output, streaming) and **OpenAI text-embedding-3-small** (embeddings).
- Prompt templates and prompt builders, scoped per use-case (summary, figure interpretation, deep agent).
- Stream normalization so the rest of the app sees a uniform chunk shape regardless of provider.
- A telemetry wrapper that writes one row to `llm_calls` per model invocation.

Currently `.gitkeep`-only. Implementation lands in **Issues 05–06**.

