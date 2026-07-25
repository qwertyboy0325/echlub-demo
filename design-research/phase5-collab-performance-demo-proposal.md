# Phase 5 — Shiki Collaborative Performance Demo · Implementation Proposal

Status: **AUTHORIZED — WP-L1–L4 landed; Phase 5 demo pending** (owner L1–L5 approved 2026-07-25)
Date: 2026-07-25
Baseline: `rewrite/collaborative-studio-v2` @ `d96e3ce` · visual shell approved @ `3065748` · Phase 4 implementation conditionally accepted

Inputs:
- Codebase capability inventory (Composer 2.5, read-only, 2026-07-25)
- Narrative/interaction design spec (Grok 4.5, read-only, 2026-07-25)
- Owner intent statement (2026-07-25): fully automated presenter demo; ~N collaborators justified by song complexity; step-by-step MIDI clicking + timbre tweaks; Ableton Session "finish clip → press button → hear it" DJ metaphor; per-participant visible cursors + click effects; complete 7-track payoff; restart to sparse; length unconstrained.

---

## 1. Why Phase 4 ≠ owner vision (gap statement)

Phase 4 proved **domain + audio correctness** (lifecycle, 7-track hydration, dock sync, restart, preservation). It did NOT deliver:

| Owner expectation | Phase 4 reality | Evidence |
|---|---|---|
| One-click automated story | `window.__runPhase4Walkthrough` console hook, instantaneous command burst | `presenterWalkthrough.ts:35-44`, `App.tsx:29-54` |
| Audience sees each person's operations | No cursor overlay in V2 shell; legacy `PresentationEngine` unmounted | `src/presentation.ts` unused by `main.tsx` |
| Camera follows the worker | Walkthrough uses `SET_ROOM`, which locks Follow (`followLocked: true`) | `shellStore.ts:37-38` |
| Clip done → press ▶ → hear it | Exchange "Preview" only selects (no audio); Global needs Stage+Activate before any master sound | `ExchangeRow.tsx:131-133` |
| Song accumulates layer by layer | Beat 13 activates full master at once; no progressive arc | `musicalDomain.ts:175-224` |
| ~4 visible collaborators | 3 fixtures (Alex/Jordan/Sam) | `shellFixtures.ts:23-27` |

Key finding: the legacy Four-Brain GSAP choreography engine (`src/presentation.ts` — cursors, click ripples, per-actor motion profiles, drag/scrub gestures) is **complete and reusable**; only the selector target map is legacy-specific.

---

## 2. Locked constraints (unchanged)

- Tone.js Transport = musical clock authority. Presenter beats that affect music key off transport bars, never bare `setTimeout`.
- GSAP = visual projection only. Cursors/ripples never dispatch musical commands themselves; they *precede* the real `shellStore.dispatch`.
- React = presentation. Domain stays in pure TS (`src/shell/domain/`).
- Three Rooms / Focus Shell IA @ `3065748` preserved. Phase 5 adds overlay layers + slot affordances; no room rewrite.
- Public pack `shiki-no-uta-cover-public-demo-v1` (SHA `85fafb0a…def7af`): never regenerated/simplified. **Phase 5 loads derived pack** `shiki-no-uta-live-collab-demo-v1` at `public/shiki-no-uta.live-collab.pack.json`. Private pack never in public paths.
- No push / deploy / main.
- No visible Scene/Story-Beat product UI. Captions + cursors are **presenter chrome**, not product IA.

---

## 3. Cast: 4 collaborators (adopted from design spec)

Justified by song structure (7 tracks, 3715 events, 104 bars, 13 sections): 3 is too thin, 7 is cursor soup; 4 maps to real band desks.

| ID | Name | Color | Desk | Owns tracks |
|----|------|-------|------|-------------|
| p1 | Ryo | `#e76f51` | Rhythm | drums, bass |
| p2 | Kai | `#2a9d8f` | Keys | piano LH, piano RH |
| p3 | Mei | `#e9c46a` | Horns | alto, tenor |
| p4 | Ren | `#457b9d` | Guitar + Color | guitar + device/dock performance |

Build order mirrors the actual arrangement: opening is sparse (piano LH + bass), drums enter at `entry`, harmony fills, guitar colors `lead-a`, horns arrive at `trade`/`lead-c` → natural sparse-to-full arc using **20 derived loop units** from `public/shiki-no-uta.live-collab.pack.json` (see `design-research/shiki-live-collab-score-reorganization.md`). The original 80-draft preservation pack remains the SHA oracle only; Phase 5 runtime loads the derived pack.

---

## 4. Demo shape (storyboard summary)

Full 28-beat storyboard lives in the design spec (Grok report §2). Skeleton:

1. **Sparse start** (beat 1): empty 7 lanes, four idle cursors on presence rail, silence.
2. **Layer build** (beats 2–23): each collaborator, in Follow-projected view, clicks MIDI notes / adjusts velocity / tweaks devices → shares → (fork/review where narratively useful) → Global stages → **▶ Launch** (bar-quantized) → audience hears the new layer join the master. Launches accumulate: LH → bass → drums → RH → guitar → alto(fork) → tenor.
3. **Payoff** (beats 24–27): all 7 lanes active; 16-bar slice of the full Shiki master using derived loop map (`mei-alto-themeA-8` → `mei-alto-trade-8` + `ren-fork-alt-2`); mid-payoff fork audibly replaces the guitar line (collaboration has consequence).
4. **Restart** (beat 28): back to sparse, cursors return to rail; second run replays cleanly.

Target ≈ 5–6.5 min. Owner said length is unconstrained; payoff slice length is Owner Decision #4.

Required-coverage check (owner's "一步一步" list): MIDI clicking ✓ (6 beats) · velocity/timbre ✓ · device param ✓ · dock mapping ✓ · share→fork→ready→stage→launch ✓ · DJ launches ✓ (8 launches) · accumulation ✓ · 7-track payoff ✓ · fork bite ✓ · restart ✓.

---

## 5. Implementation plan (work packages, ordered)

One writer per package. All packages preserve `3065748` visuals and pass existing tests.

### WP5.1 — Progressive lane launch (domain + audio) — **M**
The single biggest semantic change. Today `activateSharedMaster(draftId, 0)` hydrates *all* pack placements at once.

- Domain (`musicalDomain.ts`): maintain `activeLanes: Set<trackId>`. New op `activateLane(trackId, draftId?)` = hydrate placements filtered to that track (+ staged clip override), sourcing materials from **derived loop units** (`kai-lh-sparse-4`, `ryo-bass-sparse-4`, `ryo-entry-4`, `kai-rh-pad-4`, `ren-comp-2`, `mei-alto-themeA-8`, `mei-tenor-answer-8`, etc.). Payoff state (all 7 lanes) must be provably equivalent to today's full hydration against the derived arrangement map (test: same material bank as Phase 4 full-activate).
- Command (`shellTypes.ts` / `shellStore.ts`): `LAUNCH_SLOT { slotId }` → marks slot `active`; adapter maps slot→lane→`activateLane`.
- Quantization: adapter schedules the bank swap at **next bar boundary** via existing `audioEngine` boundary primitives (`audioEngine.ts:336-350`); UI shows armed→fire pulse. `launchQuantization: "nextBar"` default.
- Restart clears `activeLanes`.
- Tests: per-lane hydration, accumulation order independence, payoff equivalence, restart clear.

### WP5.2 — Presenter projection + transport-synced walkthrough v2 — **M**
- New command `SET_PARTICIPANT_PROJECTION { participantId, room, tab }` mutating `projectedRoom`/`projectedTab` (today static fixtures, `shellFixtures.ts:24-26`) so Follow Active drives the camera; walkthrough stops using raw `SET_ROOM` (which locks Follow).
- Walkthrough v2 (`presenterWalkthrough.ts`): beats gain `{ afterBar?, delayMs?, waitFor?: "launchCommit" | "cueEnd" }`. Musical beats keyed to transport bars via `AudioEngine.onStep`/`onBoundary`; `delayMs` allowed only for non-musical UX pacing.
- One-click trigger: presenter-chrome "Run demo" control + `window.__runPhase5Walkthrough`; single-flight token + restart-epoch guard (StrictMode-safe, Phase 4 pattern).
- 4th participant fixture + color token (`tokens.css` participant vars).

### WP5.3 — Cursor choreography overlay — **M**
- Port `PresentationEngine` (`src/presentation.ts`) into shell: `ChoreographyOverlay` portal mounted from `App.tsx`/`FocusShell.tsx`; port `.virtual-cursor` / `.click-ripple` CSS from `standalone/src/style.css`.
- New `shellUiTargets.ts` selector registry; add stable `data-demo-target` attributes to piano cells, step cells, share/stage/launch buttons, device knobs, dock slots (mitigates cursor↔DOM drift — risk #1).
- 4 cursors, per-cast motion profiles (snappy/smooth/deliberate/medium), knob-turn + note-stagger micro-animations; off-room actors parked at 0.25 opacity on presence rail.
- Ordering contract: cursor move completes → ripple → *then* real `shellStore.dispatch`. Click must land ≥1 beat before its quantized launch commit. Fail-soft: if target missing, dispatch command + caption without fake click.
- Manual mode: cursors/captions hidden; app fully usable by hand.

### WP5.4 — Session launch UX + captions — **S/M**
- Global Arrangement: 7 Shiki lanes (Drums/Bass/Piano LH/Piano RH/Guitar/Alto/Tenor) with per-slot **▶ Launch** button; states empty/staged(armed)/active(lit + bar pulse). UI verb "Launch"; domain keeps `ACTIVATE_SLOT`/`LAUNCH_SLOT`. *(Owner Decision #2/#3)*
- Exchange row "Preview" wired to `PREVIEW_WORKSPACE` (S fix — closes "button that does nothing").
- Presenter caption strip (bottom, presenter chrome only) + render existing `activityFeed` (state already written, never rendered — `shellStore.ts:8-9`).
- No Launch on Exchange rows; no scene matrix; Stage/Launch stays Global-only.

### WP5.5 — Combined A/V narrative capture — **S/M**
- Merge screencast pipeline (`capture-shell-evidence.mjs`: frames→ffmpeg) with audio tap (`capture-phase4-audible-walkthrough.mjs`: MediaRecorder on master) into `capture-phase5-demo.mjs`; pacing driven by walkthrough `waitFor` events, not external sleeps.
- Assertions via `__shellAudioEvidence()` at checkpoints (lane count climbs 1→7, fork bite audible-state change, restart sparse).
- Foreground-tab capture documented (rAF throttling — risk #4).

Suggested sequencing: **5.1 → 5.2 → 5.4 → 5.3 → 5.5** (audio semantics first; cursors are projection over working behavior). 5.3 and 5.4 parallelizable across different files after 5.2 lands.

---

## 6. Top risks (from design spec, with mitigations)

1. **Cursor↔DOM drift** → `data-demo-target` hooks; resolve rects at step start; fail-soft.
2. **A/V desync** → musical beats keyed to transport bars/`waitFor: launchCommit`; no pure-`delayMs` chains for music.
3. **StrictMode double-start** → single-flight + restart epoch.
4. **Recording throttle** → foreground capture; transport-linked steps.
5. **"Fake collaboration" feel** → ≥1.5s dwell per edit; ≤1 Follow room-change per 8s except launches; ▶ press always visible in Global before the layer is heard.

---

## 7. Owner decisions required before implementation

| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | New cast Ryo/Kai/Mei/Ren vs keep Alex/Jordan/Sam + add 4th | **New cast** (clear desk mapping) |
| 2 | Global Arrangement: 7 Shiki lanes vs keep 4 abstract lanes | **7 lanes** (Ableton read requires track identity) |
| 3 | UI verb "Launch" vs "Activate" | **Launch** (domain command unchanged) |
| 4 | Payoff slice length | **16 bars (~42s)**; full 104 bars optional second take |
| 5 | Presenter caption strip acceptable as presenter-only chrome | **Yes** (never product IA / Story Beats) |
| 6 | Demo boot state | **Keep true sparse** (arc is the story); reject muted-skeleton variant |
| 7 | Phase 4 final gate | Close Phase 4 as "implementation accepted, evidence delivered"; Phase 5 owns the presentational demo gate |

Explicitly NOT requiring re-approval: presenter script content, cursor overlay, ▶ styling on existing slots, bar quantization, 3→4 participants, captions outside product regions.
Requiring re-approval if scope drifts: dropping Three Rooms, scene-matrix replacing Arrangement, Launch on Exchange rows, pack changes, GSAP/React owning the clock.

---

## 8. Acceptance criteria (owner gate, eye/ear-verifiable)

1. One click runs the full storyboard unattended; Stop/Restart available.
2. Sparse start: zero active lanes, silence before first ▶.
3. Four colored cursors; the active operator visibly clicks real controls with ripples.
4. Follow-driven camera switches rooms with the work; manual mode intact.
5. Every ▶ Launch: staged→active on a named lane; the new layer is audible within 1 bar.
6. Audible layer count climbs stepwise to 7.
7. Payoff is recognizably the full Shiki cover (all seven instrument families).
8. Post-fork Launch audibly differs from pre-fork master, no reload.
9. ≥1 dock param mapped + swept with audible/meter consequence.
10. Restart → sparse; second run replays with no duplicate scheduling.
11. Pack SHA unchanged; privacy audit clean.
12. Three Rooms IA intact; Stage/Launch Global-only; no Scene UI.
13. One continuous A/V capture of the full run + `__shellAudioEvidence` checkpoint log.

---

## 9. Evidence plan

- `artifacts/phase5-demo/phase5-narrative-walkthrough.webm` (video+audio, full run)
- `artifacts/phase5-demo/lane-accumulation-trace.json` (per-launch evidence snapshots)
- `artifacts/phase5-demo/manifest.json` (HEAD + hashes)
- Updated Grok cold-viewer critique after implementation
- Stop line: **ECHLUB PHASE 5 COLLABORATIVE DEMO READY — STOPPED FOR OWNER PRESENTATION APPROVAL**
