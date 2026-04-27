# `server/retrieval/`

Hybrid search across the user's library: vector + full-text, fused and diversified.

## What goes here

- **Vector search** via pgvector against highlight embeddings.
- **Full-text search** via Postgres `tsvector` over highlight + page text.
- **RRF fusion** (Reciprocal Rank Fusion) to combine the two ranked lists.
- **MMR diversification** so results don't all come from the same document or section.
- A small embedding utility that calls `server/ai` for the query embedding.

## Flow

```
query → embed → [vector top-k, FTS top-k] → RRF fuse → MMR diversify → ranked results
```

Currently `.gitkeep`-only. Implementation lands in **Issues 09–11**.

