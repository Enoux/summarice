# `lib/citations/`

Markdown citation parsing and rendering. Crosses the client/server boundary — both the summary generator (server) and the summary tab (client) use it.

## What goes here

- A parser that turns `[^n]` markdown tokens into a structured AST.
- A whitelist validator: given a set of valid ordinals, reject summaries that cite outside the whitelist (PRD Decision N).
- A renderer that turns parsed citations into interactive **citation pills** with hover popover and jump-to-source behavior.

Currently `.gitkeep`-only. Implementation lands in **Issues 07–08**.

