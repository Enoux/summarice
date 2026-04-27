# `eval/`

Python evaluation harness for retrieval quality and summary quality (Lens 1, 2, 3). Talks to Postgres directly and reuses prompts from `src/lib/server/ai`.

**Deferred** — this folder is intentionally empty. Implementation tracked under **Issues 14–16**, after the core app is functional.

When work begins, expected layout:

```
eval/
  python/
    pyproject.toml      tooling TBD (uv / poetry — decide at start)
    src/                harness code
    .python-version
```

