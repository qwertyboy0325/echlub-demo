# Shiki Live-Collab Unit Inventory

Generated from `public/shiki-no-uta.live-collab.pack.json` via `npm run generate:live-collab-pack`.

| Unit ID | Desk | Bars | Events | Method | Loop |
|---------|------|------|--------|--------|------|
| ryo-bass-sparse-4 | rhythm | 4 | 8 | extract | yes |
| ryo-bass-2 | rhythm | 2 | 14 | collapse | yes |
| ryo-entry-4 | rhythm | 4 | 23 | extract | yes |
| ryo-groove-4 | rhythm | 4 | 58 | collapse | yes |
| ryo-break-4 | rhythm | 4 | 89 | extract | no (one-shot) |
| kai-lh-sparse-4 | keys | 4 | 8 | extract | yes |
| kai-lh-pulse-2 | keys | 2 | 14 | collapse | yes |
| kai-lh-walk-4 | keys | 4 | 28 | collapse | yes |
| kai-rh-pad-4 | keys | 4 | 6 | extract | yes |
| kai-rh-lift-4 | keys | 4 | 20 | extract | yes |
| mei-tenor-entry-8 | horns | 8 | 61 | verbatim | yes |
| mei-alto-themeA-8 | horns | 8 | 57 | verbatim | yes |
| mei-alto-themeB-8 | horns | 8 | 61 | verbatim | yes |
| mei-alto-trade-8 | horns | 8 | 58 | verbatim | no |
| mei-tenor-answer-8 | horns | 8 | 57 | collapse | yes |
| mei-outro-4 | horns | 4 | 9 | extract | yes |
| ren-open-4 | guitar | 4 | 18 | extract | yes |
| ren-comp-2 | guitar | 2 | 9 | extract | yes |
| ren-comp-lift-2 | guitar | 2 | 9 | collapse | yes |
| ren-fork-alt-2 | guitar | 2 | 9 | mutate-fork | yes |

**Totals:** 20 loop units · 4 desks (Ryo 5, Kai 5, Mei 6, Ren 4)

Notes (2026-07-25 mid-run review):

- `kai-rh-lift-4` re-sourced to `midi-interlude-piano-rh` (dense broken-chord RH). The
  original lead-a RH source was byte-identical to `kai-rh-pad-4` in its first 4 bars.
  Arrangement map now places the lift only in `interlude` (faithful to source) and the
  pad in all lead/instrumental/return sections.
- Known duplicate: `ren-comp-lift-2` is byte-identical to `ren-comp-2`. Every 8-bar
  guitar draft in the source shares one 2-bar comp figure (the two clusters differ by a
  single note at bars 6–7), so no honest distinct guitar lift exists. Owner decision
  pending: drop to 19 units, or keep as a separate launch slot whose lift character
  comes from live drive/presence transform. Guarded by test.

## Recognizability checklist

| Hook | Unit | Source draft | Status |
|------|------|--------------|--------|
| Entry tenor | mei-tenor-entry-8 | midi-entry-tenor | verbatim |
| Theme A alto | mei-alto-themeA-8 | midi-lead-a-alto | verbatim |
| Theme B alto | mei-alto-themeB-8 | midi-lead-c-alto | verbatim |
| Trade alto | mei-alto-trade-8 | midi-trade-alto | verbatim |
| Outro motif | mei-outro-4 | midi-outro-alto | extract (4 bars) |

## Preservation oracle

- Original pack: `public/shiki-no-uta.demo.pack.json`
- SHA-256: `85fafb0a95d81f92e87e26a4941fbdd4dff783bc6c5d0743e1f6019cd7def7af` (unchanged)
- Derived pack: `public/shiki-no-uta.live-collab.pack.json`
- `derivedFrom.packId`: `shiki-no-uta-cover-public-demo-v1`
