# `src/routes/`

SvelteKit pages. Routes are split into two **route groups** so authed and unauthed pages can have different layouts without affecting URLs.

## Layout

```
+layout.svelte           Root: theme, fonts, mode-watcher (wraps both groups)
layout.css

(auth)/                  Unauthed pages
  login/
  signup/
  logout/

(app)/                   Protected area (Auth guard / session load)
  +page.svelte           Dashboard (/) — library, search, document list
  chat/                  Deep mode chat (/chat)
  settings/              User settings
  doc/[id]/              Document Viewer (full-screen workspace)

auth/                    External auth routes
  callback/              Supabase auth callback handler

documents/               Document management
  upload/                Server-side upload trigger
```

`(auth)` and `(app)` are **route groups**, not URL segments. `/doc/[id]` is inside `(app)` to benefit from shared auth/session logic, but it provides a clean, three-pane workspace by conditionally hiding the shared navigation when in the viewer.

## Conventions

- **Auth guard** lives in `(app)/+layout.server.ts`. It handles session verification and profile loading.
- **Document URLs** use `/doc/[id]` — shareable, deep-linkable.
- **Feature components** for a route live in `src/lib/components/<feature>/`, not co-located with the route.
- **Highlight categories** in `/doc/[id]` use fixed semantic slots (`1..5`) selected via UI.

## See also

- SvelteKit route groups: https://svelte.dev/docs/kit/advanced-routing#advanced-layouts
