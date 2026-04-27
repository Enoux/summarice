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

(app)/                   Authed pages
  +layout.svelte         App shell: sidebar, user menu, etc.
  +layout.server.ts      Auth guard / session load
  +page.svelte           Dashboard (/) — library, Fast search, Deep entry
  viewer/[documentId]/
    +page.svelte         3-pane reader workspace
    +page.ts             Loads the document by id
  chat/+page.svelte      Deep mode chat (/chat — Nice tier)
```

`(auth)` and `(app)` are **route groups**, not URL segments — `/login` resolves, not `/(auth)/login`.

## Conventions

- **Auth guard** lives in `(app)/+layout.server.ts`. Anything inside `(app)/` is server-side-protected before render.
- **Document URLs** use `/viewer/[documentId]` — shareable, deep-linkable.
- **Feature components** for a route live in `src/lib/components/<feature>/`, not co-located with the route.

## See also

- SvelteKit route groups: https://svelte.dev/docs/kit/advanced-routing#advanced-layouts
