# 🧩 Feature Modules (`src/lib/features/`)

This directory contains the primary frontend feature modules of the application. Each subfolder encapsulates the UI components, client-side state, and specific logic for a distinct product feature.

## 🗂️ Module Overview

| Feature | Description |
|---------|-------------|
| [**`viewer/`**](./viewer) | The core PDF viewing experience. Manages the rendering of the document and orchestrates the different interaction layers. |
| [**`highlights/`**](./highlights) | Client-side annotation tools. Contains the UI and state management for creating, editing, and displaying text and area highlights. |
| [**`summary/`**](./summary) | The summary interface. Handles the display of the AI-generated markdown summary, citation linking, and real-time streaming updates. |
| [**`document-upload/`**](./document-upload) | The upload and onboarding flow. Manages the frontend experience for selecting, uploading, and processing new PDF documents. |

---

## 🎯 Architecture & Purpose

By grouping code by feature rather than by technical type (e.g., separating all components, stores, and utilities into global folders), we achieve a more modular and maintainable codebase. 

- **Encapsulation:** Each feature contains its own Svelte components, specialized stores, and utility functions that are relevant only to that feature.
- **Client-Side Focus:** Unlike `src/lib/server/`, the code in these directories is executed in the browser and forms the interactive user interface.
- **Integration:** These modules typically interact with the backend by communicating with their corresponding `src/lib/server/` counterparts (e.g., `features/summary` fetching from `server/summary`).

## 🚥 Status

**🟢 Operational**. All listed features are actively maintained and form the core user experience of the application.
