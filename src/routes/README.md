# `src/routes/`

SvelteKit pages. Routes are split into two **route groups** so authed and unauthed pages can have different layouts without affecting URLs.

## Layout

```
+layout.svelte           Root: theme, fonts, mode-watcher (wraps both groups)
layout.css

(auth)/                  Unauthed pages (parens hide the segment from URLs)
  +layout.svelte         Centered card layout
  login/+page.svelte
  signup/+page.svelte

(app)/                   Protected area (Auth guard / session load)
  (dashboard)/           Main application shell
    +layout.svelte       App shell: sidebar, user menu, etc.
    +layout.server.ts    Profile load
    +page.svelte         Dashboard (/) — library, Fast search, Deep entry
    chat/+page.svelte    Deep mode chat (/chat — Nice tier)

  doc/[id]/              Document Viewer (full-screen workspace)
    +page.svelte         3-pane reader workspace (Decision G5) with 5-slot highlighting + sidebar recategorization
    +page.server.ts      Loads document metadata + signed storage URL
    +page.ts             Disables SSR for PDF.js compatibility
```

`(auth)`, `(app)`, and `(dashboard)` are **route groups**, not URL segments. `/doc/[id]` is now inside `(app)` to benefit from shared auth/session logic, but nested outside `(dashboard)` so it can provide a clean, three-pane workspace without the dashboard sidebar.

## Conventions

- **Auth guard** lives in `(app)/+layout.server.ts` (if moved there) or parent layouts. Currently, `(app)/(dashboard)/+layout.server.ts` handles profile loading for dashboard pages.
- **Document URLs** use `/doc/[id]` — shareable, deep-linkable.
- **Feature components** for a route live in `src/lib/components/<feature>/`, not co-located with the route.
- **Highlight categories** in `/doc/[id]` use fixed semantic slots (`1..5`) with keyboard assignment and decorative-mode opt-out from settings.

## See also

- SvelteKit route groups: https://svelte.dev/docs/kit/advanced-routing#advanced-layouts
