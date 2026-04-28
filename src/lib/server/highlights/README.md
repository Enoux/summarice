# `server/highlights/`

Highlight management and semantic mapping.

## What goes here

- `highlight-service.ts`: Repository for highlight CRUD operations. Handles text and area highlights.
- `highlight-rls.test.ts`: Tests for Row Level Security to ensure highlights are properly scoped to users.

## Concepts

- **Semantic Slots**: Highlights are mapped to fixed semantic categories (`Key idea`, `Definition`, `Evidence`, `Question`, `Contradiction`) stored as integer slots `1..5`.
- **Area Highlights**: Support for image-based highlights (bounding boxes) in addition to text selections.
- **Tenancy**: All operations are scoped to the authenticated user's ID.
