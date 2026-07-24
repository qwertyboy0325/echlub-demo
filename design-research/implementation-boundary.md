# Implementation Boundary — Phase 3A vs 3B vs 4

## Forbidden until owner approves skeleton (now)

- Edit canonical `src/` in rewrite worktree for product UI
- Install production dependencies (dockview, interact, etc.)
- Composer feature implementation
- Delete baseline source
- Push / deploy / GitHub Release

## Phase 3A — Browser shell only (after skeleton approval)

### In scope

- New `src/` shell in rewrite worktree
- Global / Participant / Mixer workspaces per Option B
- Presenter switching (dummy state)
- Exchange rail with representative queue rows
- Representative clip drag → fork indicator (no real audio)
- Devices panel mock
- Large Live Control Dock (8 slots, dummy bindings)
- dockview + interact + floating-ui integration
- Screenshots + short recording at 1440×900, 1280×720

### Out of scope

- Real public pack playback
- Complete guided demo choreography
- Web MIDI device requirement
- Scene-visible UI
- GSAP cursor ballet

### Stop gate

`ECHLUB V2 SHELL READY — STOPPED FOR OWNER VISUAL APPROVAL`

## Phase 4 — Musical integration (after shell approval)

- Connect `audioEngine`, material bank, mix coordinator
- Real MIDI edit → revision fingerprint
- Exchange semantics: share/fork/revise/stage/activate
- Shared Master, Workspace Bleed, Clip Preview
- Restart
- Bounded guided presentation per storyboard
- Retain scene data as internal adapter only

## Role boundaries

| Role | Phase 3A |
|------|----------|
| Sol Medium | Orchestration, review, browser validation |
| Composer 2.5 | Primary code author |
| Grok | Visual QA critique at gate |
| Parallel agents | Bounded spikes only (dock, canvas, dock controls) |

## Test boundary

- New: shell layout, viewport, drag affordance tests
- Adapt: browser-load gate routes
- Remove: dashboard-specific tests per removal list

## Evidence boundary

- Shell claims: screenshot + recording verified only
- Audio claims: require Phase 4 gate
