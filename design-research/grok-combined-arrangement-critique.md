# Grok Cold-Viewer Audit: Combined Arrangement Payoff

**Context:** Phase 5 live-collab presenter walkthrough, bar ~37 beat 2 (screenshot). Viewer sees SESSION lanes populated, SHARED MASTER at 5/7, but **ARRANGEMENT score map is an empty black grid**.

**Audit lens:** First-time viewer with no codebase knowledge, watching the "materials combine into a shared song" narrative.

---

## What the viewer sees vs. what they hear

| Surface | At payoff moment | Viewer inference |
|---------|------------------|------------------|
| **SESSION table** | 7 rows, clip names (`kai-lh-sparse-4`, `ryo-entry-4`, …), states Playing/Loaded | "Everyone contributed loops; lanes are live." |
| **SHARED MASTER** | `5/7 lanes playing` (or `7/7` before fork beat) | "Something is missing — not fully combined yet." |
| **ARRANGEMENT score map** | Empty 16-bar grid, ruler only | "Nothing was arranged. Where is the song?" |
| **Audio** | Multiple lanes audible (verified in pack/render harness) | Contradicts empty grid — **visual/audio split** |
| **Presence / Exchange** | Ryo on bass, Kai LH, Mei alto, Ren forking guitar | Individual desks feel active; **ensemble picture absent** |

The viewer's complaint — *「沒看到素材完成之後組合再一起的感覺」* — is accurate: **SESSION proves parts exist; ARRANGEMENT never proves they stack into one piece.**

---

## Root cause (code)

1. **Two parallel data models, only one wired for live-collab**
   - SESSION reads `arrangementSlots` (populated by `LAUNCH_SLOT` / `COMMIT_LANE_LAUNCH`).
   - Score map reads `timelineClips` (populated in demo fixtures, **always `[]` in live-collab boot** — `createLiveCollabInitialShellState`).

2. **No projection bridge**
   - `GlobalArrangement.tsx` renders `state.timelineClips` unconditionally.
   - Lane launch reducer updates slots only; never mirrors into timeline.

3. **Walkthrough never stages timeline**
   - `presenterWalkthrough.ts` issues `LAUNCH_SLOT` / `COMMIT_LANE_LAUNCH` beats but no command touches `timelineClips`.
   - Beat 33 (`Perform · Shared Master · 7/7`) sets `sessionPhase: performing` — badge updates, grid stays empty.

4. **Not a timing bug**
   - Empty grid persists for entire session after first launch; not a transient race.

5. **Labels partially help, visuals don't**
   - `laneLaunchCaption`, `performCaption` appear in activity feed.
   - Without blocks on the grid, captions read as log noise, not spatial payoff.

---

## Why SESSION alone fails as "combination"

- Table layout = **launcher semantics** (track / clip / state / button), not **simultaneous structure**.
- Playing rows pulse individually; no shared horizontal alignment to bar columns.
- Viewer must mentally merge 7 rows into one timeline — too much cognitive load for a demo beat.

---

## Bounded fix direction (implemented)

| Change | Rationale |
|--------|-----------|
| Derive score-map blocks from `arrangementSlots` at render time | Single source of truth; no duplicate state sync |
| Blocks at `startBar: 1`, width from material id suffix (`-4`, `-8`) | Legible loop units without full DAW timeline |
| `variant: active` for playing lanes, `staged` for queued | Reuse existing clip styling |
| Header `Shared song · all lanes live` at 7/7 | Explicit combination caption on the empty-feeling zone |
| `combinedSongCaption()` on final `COMMIT_LANE_LAUNCH` | Activity feed handoff matches visual |
| Choreography hover on `arrangement-score-map` at `SET_SESSION_PHASE performing` | Cursor draws eye to payoff grid |

**Out of scope (prototype fences):** scene matrix, dual timeline, drag-drop arrangement editing, bar-offset staging per contributor.

---

## Re-capture note

Re-capture **recommended** for `phase5-narrative-walkthrough` after fix:

- Beat 28–33: score map should fill row-by-row as lanes launch.
- Beat 33: all seven rows show aligned blocks; header reads "Shared song · all lanes live".
- Bar 37 screenshot scenario (post-fork) should still show blocks for loaded/playing lanes even at 5/7.

---

## Verdict

**Primary failure:** Arrangement score map is a **disconnected stub** in live-collab mode — not a missing asset, not audio, not walkthrough timing.

**Viewer fix:** Mirror launched lane material into per-track timeline cells so SESSION (who) and ARRANGEMENT (together) tell one story.
