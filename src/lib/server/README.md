# 🖥️ Server-Side Logic (`src/lib/server/`)

This directory contains **server-only code**. SvelteKit enforces that anything in this folder is **never bundled into the browser**.

This is the home for:
- Database queries and persistence
- AI provider integrations
- Secrets management and secure environment variables
- Prompt builders and heavy business logic

---

## 🗂️ Module Overview

Each subfolder represents a distinct technical domain or feature of the backend:

| Module | Purpose |
|--------|---------|
| [**`supabase/`**](./supabase/README.md) | Database layer. Contains Supabase clients, RLS-safe repositories, and SQL helpers. |
| [**`document-upload/`**](./document-upload/README.md) | Document pipeline. Handles PDF uploads, text extraction, outline generation, and text-density scanning. |
| [**`ai/`**](./ai/README.md) | AI Provider Port. Manages prompts, stream normalization, and model calls (e.g., Gemini 3 Flash). |
| [**`summary/`**](./summary/README.md) | Summary engine. Handles prompts, citation validation, and streaming summaries to the client. |
| [**`figures/`**](./figures/README.md) | Multimodal interpreter. Extracts figure regions from PDFs and generates AI descriptions. |
| [**`highlights/`**](./highlights/README.md) | Highlight management. Handles CRUD operations, semantic mapping, and persistence for user highlights. |
| **`limits/`** | Rate limiting and usage quota logic. |

*Note: `env.ts` provides Zod-validated server environment variables. The server boot fails fast if a required variable is missing.*

---

## 📜 Core Architecture Rules

When working in `src/lib/server/`, please adhere to the following conventions:

1. **🔒 Tenancy & RLS:** Every database query must go through repositories that respect Supabase Row Level Security (RLS), keyed to the authenticated user (`auth.uid()`). **Never** bypass this using the service role key unless you are in a clearly scoped, admin-only path.
2. **🤖 AI Provider Port:** All AI model calls must route through the `ai/` module. Do not make direct `fetch()` calls to model APIs from other modules (like `summary/`). This centralized approach keeps our providers easily swappable and manageable.
3. **📊 Telemetry:** Observability is critical. Every model call must write a row to the `llm_calls` table to track usage, cost, and performance.
