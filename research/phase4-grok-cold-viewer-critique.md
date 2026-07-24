# Phase 4 Grok Cold-Viewer Critique (max 5 findings)

**Reviewer stance:** first-time viewer, no prior EchLub context.  
**Evidence reviewed:** code diff @ current HEAD, `browser-console-capture.json`, unit tests, build manifest, prior shell screenshots.

## Findings

1. **Archive A/B playback still unverified** — Branch `archive/rejected-dashboard-2026-07-24` exists locally, but Step 1 side-by-side playback @ `1be1206` was not executed. Rewrite runtime proof is stronger (lifecycle, master layers, restart) but does not substitute archive comparison.

2. **MIDI editor scope remains bounded** — Piano roll edits (step, velocity, insert-from-pack) are demo-grade, not DAW-complete. Acceptable for Phase 4 scope; visible if owner expects full edit parity.

3. **Exchange walkthrough clip IDs are scripted** — `presenterWalkthrough.ts` assumes `c1`/`c2` sequencing. Stable for linear demo; fragile if exchange reorder changes IDs.

4. **Shared Master now hydrates canonical opening layers** — `activateSharedMaster` applies pack `scenePlacements` + `sceneLayerStacks` and overrides activated fork on its kind layer. Browser proof shows bass/harmony/melody refs on opening scene. Full-song 7-part ear verification across all sections remains owner task.

5. **Dock sync is bidirectional (minimum proof)** — `SET_DOCK_VALUE` patches engine mix; `SYNC_DOCK_FROM_MIX` writes engine mix back to mapped dock slots. Browser observed UI 72 ↔ `mixFilter` 5816. Device-param→dock backfill when unpinned is still one-way.

## Dispositions (implementer)

| # | Disposition |
|---|-------------|
| 1 | **Open** — document blocker; owner may run archive checkout manually |
| 2 | **Accepted** — demo scope per Phase 4 authorization |
| 3 | **Accepted** — fixture-stable walkthrough sufficient for owner review |
| 4 | **Partial close** — wiring observed; owner musical ear-check pending |
| 5 | **Closed** — round-trip proof captured; automation→dock backfill deferred |

## Verdict

Integration is **demo-ready for owner musical review**. Full Phase 4 acceptance gate Steps 1–3 and 7-track ear verification remain **partially met** — not a hidden pass.
