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
  +layout.svelte         App shell: top menu bar, user account, etc.
  +layout.server.ts      Profile load
  +page.svelte           Dashboard (/) — library, search, document list
  chat/+page.svelte      Deep mode chat (/chat — Nice tier)
  settings/              User settings and preferences
  doc/[id]/              Document Viewer (full-screen workspace)
    +page.svelte         3-pane reader workspace with 5-slot highlighting
    +page.server.ts      Loads document metadata + signed storage URL
    +page.ts             Disables SSR for PDF.js compatibility
```

`(auth)` and `(app)` are **route groups**, not URL segments. `/doc/[id]` is inside `(app)` to benefit from shared auth/session logic, but it provides a clean, three-pane workspace by conditionally hiding the shared navigation when in the viewer.

## Conventions

- **Auth guard** lives in `(app)/+layout.server.ts`. It handles session verification and profile loading.
- **Document URLs** use `/doc/[id]` — shareable, deep-linkable.
- **Feature components** for a route live in `src/lib/components/<feature>/`, not co-located with the route.
- **Highlight categories** in `/doc/[id]` use fixed semantic slots (`1..5`) with keyboard assignment and decorative-mode support.

## See also

- SvelteKit route groups: https://svelte.dev/docs/kit/advanced-routing#advanced-layouts
