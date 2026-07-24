# Strong-Model Synthesis — Sol vs Grok

Sources:
- [Sol framework/library research](4402ecad-84a2-4e65-a86b-73a0a5e91d11)
- [Grok product critique](c6e4ee43-3e1d-4c9e-84e6-878c91a3b516)

**Status:** Research complete. Owner must resolve conflicts before Phase 3A.

---

## Naming collision (critical)

| Label | This repo's skeleton docs | Sol's research | Grok's research |
|-------|---------------------------|----------------|-----------------|
| **Option A** | Stage & Booths (teleport) | **Three Rooms** (route-owned full viewport) | Desk First / Exchange drawer |
| **Option B** | Exchange-Anchored Focus Shell (persistent rails) | Exchange Spine (central 24–28% column) | **Arrangement Hub + Full Workspace** ★ |
| **Option C** | Dual Canvas (50/50 split) | Dockable Workbench Presets | Performance Surface First |

When approving a skeleton, use **descriptive names**, not letter alone.

---

## Convergent findings (both models agree)

### Must not return
- Miniature multi-DAW wall / dashboard cards
- Scene-as-product UI (Entry, Return A, Bridge, Outro)
- Story beats / scripted role popups
- Route-as-slideshow / guided tour of finished song
- Scene-driven automatic progression
- Fixed Four-Brain identity mapping
- GSAP as musical authority

### Must preserve
- Tone.js Transport as sole musical clock
- Full-size single primary editor at a time
- Shared Clip Exchange as artifact + work queue
- Human select → stage → activate (not scene launch)
- Live Control Dock: 6–8 slots, bidirectional sync, playback-available
- Shared Master / Workspace Bleed / Clip Preview separation
- Presenter viewpoint changes projection only
- Reusable audio/material/offline modules (with boundary extraction)

### Viewport honesty
- **1440×900** — primary design target
- **1280×720** — hard breakpoint; Global cannot show Exchange + Arrangement + Dock at full density
- Below ~1360px width: Exchange collapses to drawer/overlay (Grok); Global becomes Exchange-primary OR Arrangement-primary mode toggle (Grok)

### Grok pass conditions for any skeleton
Mute Global screenshot must answer: *where shared work waits* and *what's on the master*.  
Mute Participant screenshot must answer: *what tool this person is editing*.  
Neither may explain the song's narrative.

---

## Divergent recommendations (owner must decide)

### 1. Framework

| | Sol | Prior research (Composer gate) |
|---|-----|--------------------------------|
| **Pick** | **Vite + React + TS** | **Vite + vanilla TS** |
| **Rationale** | Component boundaries, a11y ecosystem, @dnd-kit, Dockview-react, external domain store | Baseline reuse, smallest bundle, Dockview vanilla, no migration tax |
| **Risk cited** | React render frequency vs transport ticks | Manual lifecycle fragility at 3-workspace scale |

**Sol's React conditions if adopted:**
- Tone/audio as injected service outside React lifecycle
- Transport ticks via rAF/direct renderer — no whole-tree rerender
- External event-driven domain store; React = projection only

**Vanilla conditions if retained:**
- CSS Grid for top-level geometry first; Dockview only inside workspaces
- Command-path convergence for pointer/keyboard/MIDI
- Measure before adding React solely for ergonomics

→ **Owner gate:** `framework: react` | `framework: vanilla`

### 2. Skeleton architecture

| | Sol | Grok |
|---|-----|------|
| **Pick** | **Three Rooms** (explicit routes Global \| Participant \| Mixer) | **Arrangement Hub + Full Workspace** (peer surfaces; Exchange + Arrangement in Global; full desk on participant enter) |
| **Exchange** | Persistent rail/tray; not dominant center spine | Center/left in Global; collaboration room |
| **Navigation** | Top-level route switch; no teleport | Entering participant *replaces* Global chrome |
| **1280×720** | Fixed layouts per route | Global = Exchange full-bleed; Arrangement separate route |

**Conceptual overlap:** Grok B ≈ repo Option B (Focus Shell) ≈ Sol's "Exchange Spine" — all keep Exchange visible and one full editor.  
**Sol dissent:** prefers **Three Rooms** over spine/rail because persistent Exchange column permanently taxes editor width.

→ **Owner gate:** `skeleton: three-rooms` | `skeleton: focus-shell` | `skeleton: stage-booths` | `skeleton: dual-canvas`

### 3. Drag libraries (depends on framework)

| Use case | Sol (React path) | Prior (vanilla path) |
|----------|------------------|----------------------|
| Exchange / dock slot reorder | `@dnd-kit/sortable` | `sortablejs` + keyboard up/down |
| Timeline spatial placement | `interact.js` or pointer events | `interact.js` |
| List vs spatial boundary | Same rule: dnd-kit/sortable = 1D order only | sortablejs = 1D only |

### 4. Docking scope

| | Sol | Prior |
|---|-----|-------|
| **Dockview** | Inside Participant/Mixer only; not whole app | Top-level shell + inner panels |
| **Start** | CSS Grid fixed layouts until user-configurable docking needed | dockview from shell start |

Both agree: unrestricted docking risks rebuilding the rejected dashboard.

### 5. State model

**Sol (accepted into product model):** Event-driven domain primary.

```
ClipRevisionCreated | ClipPreviewStarted | ClipOffered | ClipAccepted
PlacementQueued | PlacementCommittedAtBoundary | MixControlChanged
ControlPinned | ParticipantTaskProfileChanged
```

Reducers → UI projections. XState only for permission/MIDI/export subgraphs.

→ Update `design-research/product-state-model.md` at implementation; no conflict with prior reducer choice.

### 6. Lifecycle UI density

**Grok warning (apply to any skeleton):** 8 visible lifecycle states per row = Jira theater.  
**Mitigation:** 4 visible states + detail on select/hover.

→ **Owner gate:** accept lifecycle compression rule.

---

## Reconciled recommendation (orchestrator)

Pending owner framework choice:

| If owner picks… | Skeleton | Framework | Shell approach |
|-----------------|----------|-----------|----------------|
| **Fastest path to shell gate** | Focus Shell (repo B) | vanilla TS | CSS Grid + optional dockview; align with archived codebase |
| **Sol architecture** | Three Rooms | React | Route-owned workspaces; @dnd-kit; dockview-react inner only |
| **Grok product test** | Arrangement Hub (≈ B) | Either | Exchange-primary Global; participant replaces chrome; collapse rules mandatory |

**No implementation until owner resolves framework + skeleton.**

---

## Accepted Grok critique additions (patch skeleton specs)

Apply to Focus Shell / Arrangement Hub if selected:

1. **Lifecycle:** max 4 visible state chips per Exchange row
2. **Tabs:** max 5 primary editor tabs; overflow menu for Automation/Queue
3. **Follow Active:** manual lock + "Following {name}" banner; no thrash
4. **Stage/Activate:** single verb home — Exchange OR Arrangement, not both competing
5. **Exchange rows:** waveform thumb + author color required; no text-only table
6. **1280×720:** Exchange → drawer; presence → 48px icons; Dock → 6 slots icon+value

---

## Sol module reuse additions

### Extract before reuse
- `audioEngine.ts` — strip `currentAct`, scene-authority branching; feed arrangement schedule from domain
- `clipExchangeCoordinator.ts` — replace `allowMusicalWrites` + script permission with domain commands
- `mixControlCoordinator.ts` — replace module-global echo flags with source-tagged writes

### Do not carry forward
- `presentation.ts`, `choreographyScript.ts`, guided focus, Four-Brain cursor system

---

## Updated owner decision checklist

- [ ] **Framework:** vanilla TS (prior) vs React (Sol)
- [ ] **Skeleton:** Three Rooms (Sol) vs Focus Shell / Arrangement Hub (Grok + prior) vs Stage Booths vs Dual Canvas
- [ ] **Lifecycle UI:** 4 visible states + detail (Grok)
- [ ] **1280×720 collapse spec:** mandatory drawer/mode toggle (Grok)
- [ ] **MCP install:** Playwright + Chrome DevTools (prior research)
- [ ] **Phase 3A go:** explicit after above

---

## Artifact updates from this synthesis

| File | Change |
|------|--------|
| `design-research/strong-model-synthesis.md` | Created (this file) |
| `design-research/recommended-skeleton.md` | Split recommendation; owner gate |
| `research/framework-decision.md` | Sol dissent documented |
| `design-research/skeleton-comparison-matrix.md` | Researcher picks column added |
| `design-research/grok-independent-critique.md` | Pointer to full Grok output |

No product source changed. No dependencies installed.
