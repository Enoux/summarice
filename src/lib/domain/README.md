# `lib/domain/`

Shared types, DTOs, and zod schemas. The contract between routes, components, and `lib/server/*`.

## What goes here

- TypeScript types for core entities (`Document`, `Highlight`, `Annotation`, `Summary`, `Citation`, etc.).
- Zod schemas for validating API/remote-function payloads at the trust boundary.
- DTOs that shape data from the server before it crosses to the client.

## Why a single folder

All boundaries import from one place. If a type drifts (e.g. server returns shape A, client expects shape B), it shows up here as a single source of truth, not two parallel definitions.

Currently `.gitkeep`-only. Schemas land alongside the issue that introduces the entity (e.g. `Highlight` schema arrives with **Issue 03**).

