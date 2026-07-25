# Shiki Live-Collab Score Reorganization · Design Proposal

Status: **AUTHORIZED — implementation in progress** (owner L1–L5 approved 2026-07-25)
Date: 2026-07-25
Baseline: `rewrite/collaborative-studio-v2` @ `d96e3ce`
Related: `design-research/phase5-collab-performance-demo-proposal.md`

Inputs:
- Pack similarity + audio bus analysis (Composer 2.5, 2026-07-25) — mechanical fingerprints, coverage %, MixParams graph
- Live-material score design (Grok 4.5, 2026-07-25) — palette, live vocabulary, desk bus, demo arc

---

## 0. Owner intent (binding)

Current public pack is a **finished transcription** (80 drafts). For a live-collaboration demo, the owner wants:

1. **Sacrifice** some per-section detail
2. **Fewer reusable materials** (loops/patterns) that participants launch and repeat
3. **Live transform** carries expressiveness: filter, delay/reverb sends, velocity, mute, device macros
4. **Audio bus / FX / synth addressing** is first-class (per-desk control, not only global mix)

**Hard rule:** never mutate `shiki-no-uta-cover-public-demo-v1`. Ship a **derived** pack. Original remains the preservation oracle.

---

## 1. Mechanical verdict (evidence)

Pack already *is* a loop library wearing a finished-score costume.

| Track | Drafts | Fingerprint clusters | Recommended loops | Event coverage |
|-------|--------|----------------------|-------------------|----------------|
| Bass | 13 | 4 | **3** | 96.9% @ k=3 |
| Guitar | 11 | 2 | **2–3** | ~100% @ k=2 |
| Piano LH | 12 | 3 | **3** | 100% @ k=3 |
| Piano RH | 13 | 3 | **3** | 100% @ k=3 |
| Alto | 10 | 7 | **5** (keep themes) | 98.5% @ k=5 |
| Tenor | 11 | 7 | **5** | 97.8% @ k=5 |
| Drums | 10 | 8 | **5** | 92.9% @ k=5 |

**Asymmetry that matches collab storytelling:**
- Rhythm / keys / guitar → collapse hard; live FX does the drama
- Horns → keep **verbatim** hooks (entry tenor, theme A/B, trade, outro motif) — song identity lives here
- Drums → hardest; keep a real break (`interlude` 173 hits → 4-bar fill), prefer 4-bar grooves over fake 2-bar tiles

Sparse→full activity is already in the form: `opening` has no drums/alto; `interlude` thins horns/guitar; `outro` drops drums/guitar/LH. The live arc does not invent sparsity — it follows the song.

---

## 2. Material palette (adopted recommendation)

**Target: 20 loop/phrase units** (down from 80), organized by Phase 5 desks.

### Ryo — Rhythm (5)
| Unit | Len | Role | Provenance |
|------|-----|------|------------|
| `ryo-bass-sparse-4` | 4 | bed | opening/entry/bridge bass family |
| `ryo-bass-2` | 2 | groove | lead-a bass cluster (8 drafts collapse here) |
| `ryo-entry-4` | 4 | light groove | entry drums |
| `ryo-groove-4` | 4 | main groove | trade∩lead-c family |
| `ryo-break-4` | 4 | fill (one-shot) | interlude drums head |

### Kai — Keys (5)
| Unit | Len | Role | Provenance |
|------|-----|------|------------|
| `kai-lh-sparse-4` | 4 | bed | opening LH |
| `kai-lh-pulse-2` / `kai-lh-walk-4` | 2–4 | groove | lead / trade LH clusters |
| `kai-rh-pad-4` | 4 | bed | entry RH cluster |
| `kai-rh-lift-4` | 4 | harmony lift | lead-a RH cluster |

### Mei — Horns (6) — most score-like
| Unit | Len | Role | Rule |
|------|-----|------|------|
| `mei-tenor-entry-8` | 8 | identity | **verbatim** |
| `mei-alto-themeA-8` | 8 | hook | **verbatim** (lead-a family) |
| `mei-alto-themeB-8` | 8 | hook | **verbatim** (lead-c family) |
| `mei-alto-trade-8` | 8 | hook | **verbatim, do not loop forever** |
| `mei-tenor-answer-8` | 8 | answer | cluster / pair with themes |
| `mei-outro-4` | 4 | cadence | outro motif ×4 + filter close |

### Ren — Guitar + Color (4)
| Unit | Len | Role |
|------|-----|------|
| `ren-open-4` | 4 | thin color |
| `ren-comp-2` | 2 | bed (already perfect 2-bar loop in pack) |
| `ren-comp-lift-2` | 2 | lift variant |
| `ren-fork-alt-2` | 2 | demo fork bite (derived mutate) |

**What audience loses (honest):** per-section drum fills, tiny guitar 36↔37 diffs, interlude RH densification, 13 scene FX snapshots as authored automation, outro as through-composed 16 bars.
**What must survive:** entry tenor, alto theme A/B, trade call, outro motif, opening sparse bed. If those five survive, it remains Shiki.

---

## 3. Live transformation vocabulary (replaces lost detail)

Cap ≤5 moves per desk in the presenter script. Dock maps **3 knobs + 1 master filter**.

| Desk | Live moves | Engine / control |
|------|------------|------------------|
| Ryo | hat filter open, kick drive, break mute/unmute, bass filter widen, groove fader swell | `drumFilter`, `drumDrive`, lane mute★, bass filter, `faders.groove` |
| Kai | harmony LP open, RH velocity crescendo, RH mute→unmute, chorus wet, LH octave macro★ | `harmonyFilter`, note velocity, lane mute★, chorus, transpose★ |
| Mei | delay throw on phrase end★, reed presence bump, alto mute / tenor answer, breath tuck, reverb bump★ | desk delay/reverb send★, `reedPresence`, lane mute |
| Ren | guitar drive/presence, master filter ride, delay wet, fork ▶ replace, texture lift | guitar inserts, `mix.filter`, `delayWet`, material swap |

★ = needs thin desk-bus extension (see §4). Exists today without ★.

---

## 4. Bus architecture (current → minimal sufficient)

### Today (file-backed)
```
drums → drumDrive → drumFilter → drumBus → drumTrim ─┬→ grooveGain → master
bass  → bassDrive → bassTrim ───────────────────────┘
harmony → harmonyFilter → (chorus pass-through) → harmonyGain → master
melody (alto/tenor/guitar) → melodyFilter → melodyGain → master
  + shared delaySend / reverbSend → FX → master
  → masterFilter → compressor → limiter → out
```
Mix is **global / layer-group**. Devices = filter, delayWet, reverbWet, masterGain. Drum has independent reverb send. **No per-desk sends.** Pack `chorusWet` fields are stored but chorus nodes are Gain pass-throughs.

### Proposed (M effort — not a DAW)
```
[Rhythm desk] drums+bass + inserts (drumFilter/drive, bass filter) + send(delay≈0, reverb)
[Keys desk]   LH+RH + harmonyFilter/chorus + send(delay med, reverb med)
[Horns desk]  reeds + presence/drive + send(delay HIGH, reverb med)
[Guitar desk] guitar + drive/presence + send(delay med-high, reverb low)
        ↓
Shared Delay + Reverb engines (one each) → Master filter → glue comp → limiter
```

| Per-desk | Global OK |
|----------|-----------|
| gain, mute, insert filter/drive, send levels | one Delay, one Reverb, master filter/comp/limiter, Transport |

**API sketch:** extend `MixParams` with `desk.{rhythm|keys|horns|guitar}.{gainDb,mute,filterHz,delaySend,reverbSend}`; ramp via existing `applyMixParamsToGraph`. Reject: per-voice compressors, 4 delay units, sidechain, full Ableton racks.

---

## 5. Phase 5 storyboard retarget

Phase 5 progressive launch order **unchanged** (LH → bass → drums → RH → guitar → alto → tenor), but materials come from the **derived pack**, not 80-draft hydration.

| Beats | Who | Material | Build vs launch | Live |
|-------|-----|----------|-----------------|------|
| 2–6 | Kai | `kai-lh-sparse-4` | build on-screen | velocity restraint |
| 7–9 | Ryo | `ryo-bass-sparse-4` | build | — |
| 10–11 | Ryo | `ryo-entry-4` | build | — |
| 12–14 | Kai | `kai-rh-pad-4` | pre-made ▶ | filter open + dock |
| 15–17 | Ren | `ren-comp-2` | build | drive |
| 18–21 | Mei/Ren | `mei-alto-themeA-8` + fork | build head / launch | delay arm |
| 22–23 | Mei | tenor answer | pre-made ▶ | — |
| 24–27 | all | themeA then trade + `ren-fork-alt-2` | section map | Ren color + fork bite |
| 28 | — | restart | clear desk mutes/sends | — |

**Important conflict resolved:** Phase 5 proposal line “hydrate full 80 at payoff” is **superseded** by “hydrate derived loop map / desk automation.” Preservation suite still locks the original SHA.

---

## 6. Derived pack spec

```text
id: shiki-no-uta-live-collab-demo-v1
derivedFrom:
  packId: shiki-no-uta-cover-public-demo-v1
  packSha256: 85fafb0a95d81f92e87e26a4941fbdd4dff783bc6c5d0743e1f6019cd7def7af
path: public/shiki-no-uta.live-collab.pack.json   # never overwrite demo.pack.json
```

Contents:
- `loopUnits[]` — id, desk, role, patternBars, trackIds, events, `provenance.{sourceDraftIds, method: extract|collapse|verbatim|mutate-fork}`, `loop: boolean`
- `arrangementMap[]` — section → trackId→loopUnitId, optional deskAutomation curves
- `soundDesign` / `defaultMix` cloned from public + desk send baselines
- `deskBus: { enabled: true, version: 1 }`
- Participant desk ownership (Ryo/Kai/Mei/Ren)

Generator contract:
1. Read original pack read-only
2. Extract/collapse/verbatim per provenance
3. Emit derived JSON only
4. CI: original SHA unchanged; derived declares `derivedFrom`; payoff recognizability checklist (themeA + trade + entry tenor present)

---

## 7. Work packages (additive to Phase 5)

| WP | Scope | Effort | Depends |
|----|-------|--------|---------|
| **WP-L1** | Generator script → `shiki-no-uta.live-collab.pack.json` + integrity tests | M | owner OK on palette |
| **WP-L2** | Desk bus MixParams + graph sends (4 desks × send/filter/mute) | M | L1 optional for UI, needed for live moves |
| **WP-L3** | Launch-time velocity scale + optional transpose; lane mute | S–M | L2 partial |
| **WP-L4** | Phase 5 storyboard retarget to derived pack + dock macros | S | L1, Phase 5 WP5.1–5.2 |
| **WP-L5** | Wire actual chorus nodes (pack already declares chorusWet) | S–M | optional polish |

Suggested order with Phase 5: **L1 → L2 → Phase5.1/5.2 → L3/L4 → Phase5.3–5.5**.

---

## 8. Owner decisions

| # | Decision | Recommendation |
|---|----------|----------------|
| L1 | Authorize derived pack `shiki-no-uta-live-collab-demo-v1` | **Yes** |
| L2 | Palette size 20 units + verbatim horn hooks | **Yes** |
| L3 | Desk bus (4 sends into shared Delay/Reverb) vs stay global-only FX | **Desk bus** (otherwise live-collab feel is fake) |
| L4 | Phase 5 loads derived pack; original remains preservation-only | **Yes** |
| L5 | Allow generator to *collapse* exact-duplicate MIDI (not regenerate melodies) | **Yes** — extract/collapse/verbatim only; no AI rewrite |

---

## 9. Risks

1. Loops feel mechanical → 4-bar drums; never loop trade alto; keep break one-shot
2. Song not recognizable → hard gate on verbatim hooks + ear check before UX polish
3. FX mud → horns own delay throws; rhythm delaySend ≈ 0; keep glue/limiter
4. Scope creep into DAW → hard cap 4 desk strips + 2 shared engines + 3 dock macros
5. Provenance confusion → CI on original SHA; README: live-collab ≠ archival cover

---

## 10. Relationship to Phase 5 proposal

| Document | Role |
|----------|------|
| `phase5-collab-performance-demo-proposal.md` | Presenter demo: cursors, Follow, ▶ Launch, 4 cast, storyboard shell |
| **This document** | Musical source material + bus that make the jam *feel* collaborative |

Authorize both together, or authorize this score reorganization first if Phase 5 should not start on the 80-draft pack.
