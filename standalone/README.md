# Standalone — Deprecated for Round 2

The `standalone/` directory contained a manually duplicated Round 1 implementation that diverged from canonical source.

**Round 2 deprecates this duplicate.** Use the canonical build instead:

```bash
npm install
npm run build
npm run preview
```

The build output in `docs/` is the single authoritative browser artifact.

Do not manually maintain parallel source copies.
