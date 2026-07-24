# Phase 4 Grok Cold-Viewer Critique (max 5 findings)

**Reviewer stance:** first-time viewer, no prior EchLub context.  
**Evidence reviewed:** code diff, test output, build manifest, shell screenshots path (not live audio).

## Findings

1. **Archive A/B playback unverified** — Static pack integrity tests pass, but Step 1 of the acceptance gate (archived implementation @ `1be1206` side-by-side playback) was not executed. Musical completion claim rests on adapter wiring, not comparative runtime proof.

2. **MIDI editor scope is bounded, not DAW-complete** — Piano roll supports step nudge, velocity, insert-from-pack, and step toggles. Resize note duration and multi-note drag are absent; acceptable for demo scope but visible if owner expects full edit parity.

3. **Exchange lifecycle walkthrough uses scripted clip IDs** — `presenterWalkthrough.ts` assumes `c1`/`c2` after share/fork. Works for linear demo but fragile if exchange order changes or clips are reordered via sortablejs.

4. **Shared Master activation pins bass layer only** — `activateSharedMaster` assigns edited draft to `scene.layers.bass` at bar 0. Full 7-track Shiki arrangement playback on activate is not wired; master hears the activated revision on bass layer during livePerformance act, not full canonical cover.

5. **Dock/device param sync is one-way UI→audio** — Knob/fader changes dispatch to AudioEngine mix params with smoothed ramps, but audio graph changes do not write back to dock slot values. Bidirectional sync is partial (canonical source is audio graph; UI holds projection).

## Verdict

Integration is **demo-ready for owner musical review** with honest gaps on archive A/B, full-arrangement master playback, and bidirectional dock sync. Do not claim full Phase 4 gate pass until Steps 1–3 and 6 runtime evidence are captured.
