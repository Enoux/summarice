# 🛣️ App Routes & Server Endpoints (`src/routes/(app)/`)

This directory contains the primary routing structure and API endpoints for the authenticated web application. While the client-side UI lives in `+page.svelte` files, this document focuses on the **server-side routes (`+server.ts`) and data loaders (`+page.server.ts`)** that power them.

## 🗂️ API Endpoints (`+server.ts`)

These files act as our backend API, handling specific HTTP methods (GET, POST, PUT, DELETE) and Server-Sent Events (SSE) streaming.

| Endpoint | Purpose |
|----------|---------|
| `doc/[id]/highlights/+server.ts` | **Highlights CRUD:** Manages the creation, retrieval, updating, and deletion of user highlights within a specific document. |
| `doc/[id]/annotations/+server.ts` | **Annotations CRUD:** Handles saving and fetching user notes and comments attached to specific highlights. |
| `doc/[id]/summary/+server.ts` | **Summary Fetching:** Retrieves existing, completed summaries and their associated citations for a document. |
| `doc/[id]/summary/stream/+server.ts` | **Summary Streaming:** Provides a Server-Sent Events (SSE) connection to stream the AI-generated summary back to the client in real-time. |
| `doc/[id]/figure-interpretation/stream/+server.ts` | **Figure Interpretation Streaming:** Uses SSE to stream multimodal AI descriptions of area highlights (figures, charts) in real-time. |

---

## 📄 Server Page Loaders & Actions (`+page.server.ts`)

These files run **exclusively on the server** before a page renders, or when a user submits a form.

| Route | Purpose |
|-------|---------|
| `doc/[id]/+page.server.ts` | **Document Initialization:** Securely fetches the initial document metadata, user settings, and pre-hydrates existing highlights/comments so the PDF viewer loads instantly. |
| `settings/+page.server.ts` | **Settings Management:** Loads the user's custom preferences (e.g., highlight category names) and processes form actions to save updates to the database. |

## 🎯 Architecture & Security Rules

1. **🔒 Authentication Required:** Because this entire directory is under the `(app)` layout group, all endpoints assume the user is authenticated. 
2. **🛡️ Tenancy via Locals:** Always extract `locals.supabase` and `locals.user` within these endpoints to perform database operations. This ensures Row Level Security (RLS) is strictly enforced.
3. **Delegation:** Do not put heavy business logic inside the route files. These endpoints should validate the request (e.g., parsing parameters, checking auth) and immediately delegate the hard work to the corresponding modules in `src/lib/server/` (like `server/summary`, `server/highlights`, etc.).
