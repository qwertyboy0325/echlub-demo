# Shiki No Uta Preservation Addendum

Owner-binding rules for the EchLub rewrite. Supersedes informal assumptions about musical mutability during visual-shell work.

## Status

- **Binding:** owner-approved preservation addendum (2026-07-24)
- **Branch:** `rewrite/collaborative-studio-v2`
- **Phase 4:** blocked until musical preservation gates and acceptance checklist pass

## Two required preservation targets

### 1. Historical reproducibility

The archived implementation must remain capable of reproducing the previously accepted Shiki no Uta playback from its authoritative archive commit.

### 2. Forward compatibility

The rewrite must remain capable of loading and performing the same approved public musical material through the new presentation layer in Phase 4.

## Canonical public asset

Preserve the approved public pack:

**`shiki-no-uta-cover-public-demo-v1`**

Authoritative path: `public/shiki-no-uta.demo.pack.json`

Deployed mirror: `docs/shiki-no-uta.demo.pack.json` (GitHub Pages build output; must remain a public derivative only)

Do **not** modify musical content during visual-shell work (Phase 3B.x).

### Forbidden without explicit owner approval

- delete notes
- requantize timing
- transpose material
- normalize velocities
- simplify automation
- replace reconstructed phrases with generated approximations
- silently change instrument assignments
- rewrite arrangement timing merely to fit the new UI

Any future musical change requires explicit owner approval and a before/after comparison.

## Private boundary

The private source:

`local-reconstruction/shiki-no-uta.midi-only.pack.json`

must remain private.

It must **never** be copied into:

- `public/` assets
- `docs/**`
- build output (`dist/`)
- screenshots or public evidence
- committed public fixtures
- deployed artifacts

The public demo must use only the approved public pack or an explicitly audited public derivative.

## Required preservation evidence before Phase 4 completion

See `research/shiki-no-uta-preservation-report.md` for machine-generated inventory and boundary audit.

Automated integrity coverage: `src/validation/shikiPublicPack.test.ts`, `src/validation/shikiPackIntegrity.ts`.

## Phase 4 acceptance gate

See `research/shiki-no-uta-phase4-acceptance-gate.md`.

Before the rewrite may claim musical completion:

1. run the archived Shiki no Uta version
2. run the rewrite using the same approved public material
3. capture comparable playback evidence
4. verify that all intended musical parts are present
5. verify that no obvious note, timing, velocity or assignment loss occurred
6. verify restart and replay
7. verify the public build contains no private reconstruction source

The new UI may present and arrange the material differently, but it must not destroy the reconstructed score.

If the rewrite cannot yet reproduce the piece, report it as an incomplete adapter or integration issue. Do **not** regenerate or approximate the score to hide missing compatibility.

## Archive reference

| Item | Value |
|------|-------|
| Archive branch | `archive/rejected-dashboard-2026-07-24` |
| Archive tip (implementation) | `1be1206394ab0416a6cd87bc2914a99e59b09576` |
| First public pack publish | `4e00eb6` — feat(demo): publish Shiki No Uta browser cover |

Historical playback reproduction uses the archive branch checkout at `1be1206`, not the rewrite worktree alone.

## Agent constraints

- Do not modify musical content of the public pack during shell or visual work
- Do not copy private pack content to public paths
- Do not regenerate or approximate score material
- Preservation tests must pass in `npm run test` before Phase 4 musical claims
