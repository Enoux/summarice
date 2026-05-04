# `lib/pdf-highlighter/`

A customized, vendored PDF highlighter library based on `react-pdf-highlighter` but ported to Svelte 5.

## Key Features

- **Text & Area Highlighting**: Supports both text-based highlights and area-based screenshot capture.
- **Smart Positioning**: Tip and popup positioning logic with boundary clamping and entry-point awareness.
- **Interactive Popups**: Unified system for new selection, hover preview, and editing modes.
- **AI Integration**: Specific support for "Explain Figure" actions on area highlights.
- **Refactored Architecture**: Modular logic for positioning, hover contracts, and popup state management.

## Directory Structure

- `components/`: Svelte 5 components for the PDF viewer, highlights, and tooltips.
- `lib/`: Core logic for positioning, zoom, and state management.
- `style/` & `styles/`: CSS for the highlighter and popups.
- `types.ts`: TypeScript definitions for highlights, tools, and UI states.

## Recent Improvements

- Modularized positioning and popup mode logic into dedicated utility files.
- Introduced shared contracts for hover interactions to ensure UI stability.
- Externalized styles for better maintainability and theme consistency.
