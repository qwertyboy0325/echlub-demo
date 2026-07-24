# Owner-Approved Architecture — EchLub V2 Shell

**Locked:** 2026-07-24  
**Phase:** 3A fixture shell (no audio wiring)

## Product model

EchLub V2 is a collaborative studio prototype: three full-viewport Rooms sharing a Focus Shell layout. React projects fixture state from a pure TypeScript domain store. Tone.js Transport remains the future musical clock authority but is **not wired** in Phase 3A.

## Three Rooms

### Global Studio

- **Center:** Arrangement / Launcher (dominant ~60%+ height)
- **Bottom:** Shared transport (fixture playhead)
- **Exclusive:** Stage and Activate controls
- **Includes:** Shared Master meter strip, activity feed (provenance, not scene names)
- **Forbidden:** Scene terminology, story beats, miniature editors

### Participant Workspace

- **Header:** Clip id, revision, creator, source (persistent context)
- **Tabs (max 5):** Create | Devices | Automation | Mix | Queue
- **Create sub-modes:** Piano Roll | Step | Clip editor (toggle, not tabs)
- **Center:** dockview-react editor group; optional floating Devices inspector
- **Bottom:** Transport only (no Stage/Activate)
- **Exchange:** Share, fork, claim, revise via right rail

### Mixer / Performance

- **Center top:** Channel strips + meters (fixture)
- **Center bottom:** Live Control Dock — 6–8 large slots (knob/fader/toggle/momentary)
- **Badges:** PREVIEW | CAPTURE | MASTER per slot (fixture toggles)
- **interactjs:** Param-to-slot snap (visual only)
- **No** arrangement staging surface

## Focus Shell (shared grid)

```
┌─────────────────────────────────────────────────────────────┐
│ Presenter nav · Follow Active · transport readout           │
├────────┬──────────────────────────────────────┬─────────────┤
│Presence│         CENTER (dominant)            │  Exchange   │
│  rail  │         per Room                     │  rail/drawer│
├────────┴──────────────────────────────────────┴─────────────┤
│ Transport (48px) OR Live Control Dock (112–140px in Mixer)  │
└─────────────────────────────────────────────────────────────┘
```

| Region | Wide (≥1360) | Drawer (1280–1359) | Compact (1280×720) |
|--------|--------------|--------------------|--------------------|
| Left | 200px | 200px | 48px icons |
| Right Exchange | 320px fixed | overlay drawer | overlay drawer |
| Bottom | room-dependent | room-dependent | dock 6 slots icon+value |

## Shared Clip Exchange

- **4 lifecycle chips only:** Available | In Progress | Review | Ready
- Rows: waveform thumbnail + chip + lineage metadata (author color)
- **sortablejs:** queue ordering only
- **interactjs:** drag to Global arrangement to stage
- Exchange cards **never** expose Stage/Activate

## Follow Active lock

1. When enabled, UI follows the active participant's Room/tab projection
2. Manual room or participant select **breaks** follow
3. Resume only via explicit "Resume Follow" control
4. Follow **frozen** during: drag, knob hold, open popover
5. Room switch preserves fixture state (no reset)

## Stage / Activate (Global only)

1. Drag clip from Exchange → arrangement slot → **staged**
2. Human clicks **Activate** on staged slot → **active** (fixture)
3. Commands exist only in `shellCommands` arrangement path
4. No scene-driven automatic progression

## Domain layer (Phase 3A)

Path: `src/shell/domain/`

- `shellTypes.ts` — Room, lifecycle, arrangement slot, follow, viewport
- `shellFixtures.ts` — participants, clips, thumbnails
- `shellStore.ts` — immutable reducer + subscribe
- `shellCommands.ts` — share, fork, claim, revise, submit, stage, activate, dock pin, follow

## Library boundaries

| Library | Scope |
|---------|-------|
| dockview-react | Participant center only |
| interactjs | Exchange drops, dock snap, arrangement affordances |
| sortablejs | Exchange queue lists only |
| @floating-ui/dom | Device/inspector popovers |
| CSS Grid | Focus Shell outer layout |

**Not in Phase 3A:** @dnd-kit, react-sortablejs, XState, Tone performance wiring

## Explicit non-goals (Phase 3A)

- Tone.js performance wiring, Workspace Bleed audio, real Web MIDI
- Guided demo choreography, Story Beats, visible Scene UI
- Complete Clip domain backend
- Rejected dashboard layout (`src/ui/appShell.ts` etc. remain unmounted)
- Push / deploy / main modification

## Evidence gate (Owner Gate 2)

Shell must demonstrate at 1440×900 and 1280×720:

- All three Rooms navigable
- Exchange with 4 chips and thumbnails
- Follow lock break/resume
- Stage/Activate visible only in Global
- Tests: `npm run typecheck && npm run build && npm run test`
- Screenshots: `artifacts/shell-ready/`

Stop line: **ECHLUB V2 SHELL READY — STOPPED FOR OWNER VISUAL APPROVAL**
