# Fable Design Gap Audit — Create→Library→Share

**Date:** 2026-07-25  
**Sources:** Fable Phase 5 drift review (agent `06ecfdac`), owner clarification on cold-viewer story, Grok workspace/arrangement critiques.  
**Baseline HEAD before this pass:** `6ec0c24`

---

## Primary gap (owner-binding)

**Desired:** Score builds from zero; creator ops are legible: private desk → click MIDI/steps → **Save to library** → clip appears in private library → **Share to Exchange** → stage/launch Shared Master.

**Before this pass:** Domain had Create edits + `SHARE_CLIP` straight to Exchange. No private library surface or `SAVE_TO_LIBRARY`. Walkthrough jumped Create → Share in one beat; library list was a Queue stub. Cold viewers could not see “this is my clip, then it becomes public.”

---

## Defect-first gap list

### Collaboration loop (primary)

| Fable / owner said | Was | Now |
|---|---|---|
| Create → save private → publish public | Share skipped library | `SAVE_TO_LIBRARY` + desk library list; Kai/Ryo dedicated save beats |
| Captions: shaping → saved → shared | `Exchange: … shared` only | `Private desk · shaping…` → `Saved to library · …` → `Shared to Exchange · …` |
| Cursor on save control | N/A | `data-demo-target="save-to-library"` + choreography |

### Create / spatial

| Said | Was | Now / deferred |
|---|---|---|
| Visible MIDI/step edits | Present but fast | Kai/Ryo dwells lengthened (`delayMs` + `afterBar: 2`) |
| Private desk identity | Mostly landed @ `6ec0c24` | Kept; library panel reinforces desk-local scope |
| From-zero arrangement fill | Score map projection landed earlier | Unchanged; still sparse→fill via launches |

### Perform / recall / promote / presence / captions

| Said | Status |
|---|---|
| Transport-first launches + afterBar | Already fixed pre-pass — keep |
| Fork / dock / desk FX narrative | Present — keep |
| Restart + ENABLE_FOLLOW | Fixed this pass (beat 40) |
| `waitFor: "launchCommit"` | **Deferred** — afterBar covers audible pacing; commit wait is polish |
| SET_LANE_MUTE in script | **Deferred** — lower than library loop |
| Cast dedup in pack | **Deferred** — polish |

### Rejected patterns (still avoided)

- Scene matrix / dual timeline / full DAW / real multiplayer — not introduced
- Launch still Global-only; captions remain presenter chrome

---

## Beat map delta (PHASE5)

| Was (37) | Now (40) |
|---|---|
| 3–5 Kai create (fast) → 6 Share | 3–5 Kai create (slower) → **6 Save library** → **7 Share** |
| 9–10 Ryo create → share | 10–11 Ryo create/shape → **12 Save** → **13 Share** |
| Ren/Mei share bundled | Ren/Mei include `SAVE_TO_LIBRARY` before share |
| 37 Restart only | 40 Restart + ENABLE_FOLLOW + global room |

Downstream beats shifted +3 after Ryo share insert (Ren create now beat 23, Mei create 28, restart 40).

---

## Fixed this pass vs deferred

**Shipped**

- `DeskLibraryClip` + `libraryClips` on participant workspace
- `SAVE_TO_LIBRARY` command + captions
- Create: Save / Share buttons + private library list; Queue wired to real library
- Walkthrough create→library→share visibility for Kai, Ryo (+ Ren/Mei save)
- Tests + capture beat constants updated

**Deferred (with reason)**

- `waitFor: "launchCommit"` — needs adapter event hook; afterBar already gates audible launches
- True empty-draft “new clip” authoring — pack units still seed desks; prototype fence
- `/present` auto-start on Play — separate UX pass; Run demo remains explicit
- Re-capture A/V — **required** after this narrative change

---

## Re-capture

**Required:** `npm run capture:phase5-demo` (or `validate:phase5-demo`) under `dev:live-collab`. Prior `artifacts/phase5-demo/*` predate library beats and longer Kai/Ryo dwells.
