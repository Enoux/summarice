# 🖍️ Highlight Management (`src/lib/server/highlights/`)

This module handles the core CRUD operations, persistence, and semantic mapping for all user annotations (highlights) within documents.

## 🏗️ Architecture & Contents

- **`highlight-service.ts`:** The primary service and repository layer for highlight operations. It is responsible for saving, updating, and retrieving both text-based and image-based (area) highlights.
- **`highlight-rls.test.ts`:** Critical security tests verifying that Postgres Row Level Security (RLS) is correctly applied, ensuring users can only access their own highlights.

## 🧠 Core Concepts

To understand how highlights work in the codebase, you need to know:

- **Semantic Slots:** We don't just store random colors. Highlights are mapped to specific semantic categories to aid in summarization. These are stored in the database as integer slots (`1..5`):
  1. `Key idea`
  2. `Definition`
  3. `Evidence`
  4. `Question`
  5. `Contradiction`
- **Area Highlights:** Beyond standard text selection, the system supports image-based highlights (bounding boxes), which are crucial for the `figures/` interpretation module.
- **Tenancy:** Every single highlight operation is strictly scoped to the authenticated user's ID.
