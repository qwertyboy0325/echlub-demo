# Rules and Authority Map — EchLub Rewrite (2026-07-24)

## Authority order (active)

1. **Owner instruction** (this rewrite package) — supersedes stale implementation prompts
2. **Repository rules** — `.cursor/rules/**`, `AGENTS.md`
3. **Owner-approved design skeleton** — pending first gate
4. **Implementation constraints** — `package.json`, tests, public pack
5. **Model preference** — lowest

## File classification

| Path | Classification | Notes |
|------|----------------|-------|
| Owner rewrite instruction (chat) | **Canonical** | Mandates research-first, two owner gates |
| `AGENTS.md` | **Canonical** | Entry point; model roles; git policy |
| `.cursor/rules/00-model-policy.mdc` | **Canonical but partially stale** | API models forbidden by default; owner explicitly authorizes Sol Medium + Grok for research |
| `.cursor/rules/10-work-packages.mdc` | **Canonical** | Owner gates; evidence discipline |
| `.cursor/agents/*.md` | **Useful, non-authoritative** | Specialist auditors; scoped to Four-Brain era wording |
| `README.md` | **Stale for product** | Still describes Round 1 Four-Brain DJ Lab |
| `CLAUDE.md` | **Missing** | Referenced in AGENTS.md but not present |
| `.cursor/skills/**` | **Not in repo** | User-global Cursor skills only |
| `.cursor/mcp.json` / `.mcp.json` | **Missing in repo** | MCP config is user/Cursor-level |
| `package.json`, `package-lock.json` | **Canonical (baseline)** | Rewrite worktree at 4a18901 deps: tone, gsap, fflate, vitest, puppeteer |
| `vite.config.ts`, `tsconfig.json` | **Canonical** | Vite 7, strict TS, GitHub Pages base |
| `public/shiki-no-uta.demo.pack.json` | **Canonical public pack** | Approved demo data |
| `src/**` (baseline) | **Canonical source** | Rewrite replaces presentation; audio/domain partially reusable |
| `src/**` (archive branch) | **Archived, non-canonical** | `archive/rejected-dashboard-2026-07-24` @ `1be1206` |
| `archive/rejected-dashboard-2026-07-24-FAILURE-NOTE.md` | **Canonical failure record** | Tracked rejection rationale |
| `artifacts/**` | **Private evidence** | Gitignored; owner-review packet hashes verified |
| `local-reconstruction/**` | **Private** | Never commit |
| `reference-private/**` | **Private** | Never commit |
| `docs/**` | **Generated deploy output** | Rebuilt on release; not design authority |
| `standalone/**` | **Legacy snapshot** | Non-canonical parallel tree |
| `.github/**` | **Missing** | No CI workflows in repo |
| `scripts/*` | **Useful** | Browser gates, capture, export — adapt targets post-rewrite |
| `research/**`, `design-research/**` | **Canonical for rewrite phase** | This research round |

## Stale or conflicting items

| Item | Conflict | Resolution |
|------|----------|------------|
| README "Four-Brain Round 1" | Product is now collaborative studio | README update deferred to post-skeleton implementation |
| AGENTS.md "performance script = semantic authority" | Human-driven arrangement replaces visible scene flow | Retain script only as internal guided-demo adapter after Phase 4 |
| `00-model-policy` API ban | Owner authorizes Sol Medium + Grok for research | Research-only exception; implementation still Composer |
| Archive strategy doc asked owner to choose freeze vs reset | Owner chose clean rewrite with archive branch + worktree | Archive branch created; worktree at 4a18901 |
| Visual/audio auditor agents reference "Four cursors" | May not apply to v2 | Re-scope auditors at shell gate |

## Privacy exclusions (verified)

`.gitignore` excludes: `artifacts/`, `local-reconstruction/`, `reference-private/`, `.env*`, `node_modules/`, `dist/`.

Owner-review packet at `artifacts/owner-review/` — private, hash-indexed, not committed.

## Git state (Phase 0 complete)

| Item | Value |
|------|-------|
| `main` | `4a18901` (unchanged) |
| Archive branch | `archive/rejected-dashboard-2026-07-24` @ `1be1206` |
| Rewrite branch | `rewrite/collaborative-studio-v2` @ `4a18901` |
| Rewrite worktree | `/Users/Ezra4/Coding/Repo/echlub-demo-rewrite` |
| Push | None (authorized local only) |

## Patch reconstruction note

- `artifacts/owner-review/echlub-collaborative-studio.patch` + untracked patch reconstruct most source deltas from `4a18901`
- Binary diffs (`docs/assets/*`, large pack JSON) may fail `git apply`; **archive commit is authoritative** for full reconstruction
