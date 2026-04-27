# `lib/domain/`

Shared types, DTOs, and zod schemas. The contract between routes, components, and `lib/server/*`.

## What goes here

- TypeScript types for core entities (`Document`, `Highlight`, `Annotation`, `Summary`, `Citation`, etc.).
- Zod schemas for validating API/remote-function payloads at the trust boundary.
- DTOs that shape data from the server before it crosses to the client.
- Shared highlight-category/domain helpers used by viewer and API boundaries.

## Why a single folder

All boundaries import from one place. If a type drifts (e.g. server returns shape A, client expects shape B), it shows up here as a single source of truth, not two parallel definitions.

## Current files

- `highlight-categories.ts` — fixed 5-slot category IDs, default labels, and default slot colors.
- `highlight-mapper.ts` — mapping between DB highlight rows and viewer `CommentedHighlight`, including category/color handling for semantic vs decorative modes.

