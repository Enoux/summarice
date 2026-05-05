# 🧠 AI Provider Port (`src/lib/server/ai/`)

This directory serves as the **AI Provider Port**. It is the centralized hub for all Large Language Model (LLM) communications. **No other module in the codebase should make direct `fetch()` calls to model APIs.**

## 🎯 Purpose & Contents

By funneling all AI interactions through this port, we ensure that our AI providers remain easily swappable, observable, and consistent.

- **Unified Interface:** Exposes a thin, provider-agnostic port interface (`generate`, `embed`, `vision`, `stream`) that hides the underlying implementation details of specific AI APIs.
- **Provider Adapters:** Contains adapters for our current routing layer, **OpenRouter**, which bridges requests to **Gemini 3 Flash** (for text generation and multimodal vision) and **OpenAI** (for vector embeddings).
- **Stream Normalization:** Ensures that streaming responses from different models are normalized into a uniform chunk shape before being sent to the client.
- **Telemetry & Billing:** Automatically tracks tokens, latency, and cost for every model call, writing this data directly to the `llm_calls` table for observability.

## 🚥 Status

**🟢 Operational**. This provider port is actively powering core application features, including figure interpretation, summary generation, and other interactive AI components.
