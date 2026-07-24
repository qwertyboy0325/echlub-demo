# Skeleton Comparison Matrix

| Dimension | Option A — Stage & Booths | **Option B — Focus Shell** ★ | Option C — Dual Canvas |
|-----------|---------------------------|------------------------------|------------------------|
| Primary metaphor | Concert stage + backstage | IDE / Figma + DAW focus | Shared board + personal desk |
| Global layout | Timeline hero | Timeline + master scope in center | 50% shared kanban |
| Participant layout | Full-screen teleport | Center editor, persistent rails | 50% editor split |
| Mixer layout | Dedicated booth | Center dock 45% height | Right half mixer |
| Exchange visibility | Bottom + ticker | **Always-on right rail** | Kanban columns |
| Presence | Activity rail on stage | **Left rail 200px** | Dots on margin |
| Presenter switch cost | High (teleport) | **Low (center morph)** | Medium (maximize) |
| Collaboration legibility | Good | **Best** | Very good |
| Arrangement focus | Excellent | **Very good** | Moderate |
| Live Control Dock size | Good (booth only) | **Excellent** | Cramped |
| 1440×900 fit | Good | **Good** | Tight |
| 1280×720 fit | Good | Good w/ collapse | Poor |
| Mobile/narrow | Stage read-only | **Global read-only** | Shared board only |
| Distance from rejected dashboard | High | **Highest** | Medium |
| Implementation risk | Transition UX | Shell integration | Width math |
| Library fit | dockview booths | **dockview + rails** | interact kanban |
| **Recommendation** | Alternate | **Grok + prior** | Alternate |

### Researcher picks (see `strong-model-synthesis.md`)

| Researcher | Pick | Notes |
|------------|------|-------|
| Grok | **Focus Shell / Arrangement Hub** (≈ B) | Kill list + 1280×720 collapse rules |
| Sol | **Three Rooms** (≠ repo Stage Booths A) | Route-owned 100% viewport; prefers React |
| Prior orchestrator | **Focus Shell (B)** | vanilla TS |

**Naming:** repo Option A = Stage & Booths. Sol "Option A" = Three Rooms — different designs.

## Owner selection

- [ ] **Focus Shell (B)** — Grok-aligned; persistent rails
- [ ] **Three Rooms (Sol)** — explicit Global \| Participant \| Mixer routes
- [ ] **Stage & Booths** — repo Option A; teleport
- [ ] **Dual Canvas (C)** — 50/50 split
- [ ] **Framework:** vanilla | react
- [ ] Hybrid (specify): _______________
