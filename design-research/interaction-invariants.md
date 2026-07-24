# Interaction Invariants

Hard constraints for research, skeleton, and implementation.

## Participants

- Participant count is data-driven, not hard-coded to four
- Identity ≠ current task; one person may MIDI → FX → arrange over time
- Roles are workspace presets / task profiles, not permanent personas
- Presence shows who is active, not a fixed cast

## Viewpoints

- Presenter modes: **Global Studio** | **Participant Workspace** | **Follow Active**
- Switching viewpoint changes projection only — never music or collaboration state
- Follow Active tracks the participant with latest meaningful edit or presenter selection

## Workspaces

Each participant workspace switches among: Clip | MIDI | Step | Devices | Automation | Mix | Queue | Launcher | Arrangement

- Exactly one primary editor full-size at a time
- Never render multiple complete miniature DAWs simultaneously

## Shared Clip Exchange

- Public artifact exchange AND work queue
- Lifecycle: Personal Draft → Shared → Forked/Claimed → In Progress → Ready for Review → Revised → Ready for Arrangement → Staged → Active/Arranged
- Drag into another workspace creates fork/working copy — never destructive removal
- Lineage, contributor, requested next action always visible on Exchange rows

## Human-driven arrangement

- No required visible Scene primitive
- Humans select, stage, activate, place clips
- Scene pack data may exist only as internal compatibility adapter

## Live Control Dock

- 6–8 persistent slots in Mixer/Performance workspace
- Slot types: knob | fader | toggle | momentary
- Drag map from Devices/tracks/Clips into slots
- Bidirectional sync between dock and source control
- Preview | automation capture | Shared Master activation remain distinct modes

## Audio separation

| Mode | Purpose |
|------|---------|
| Shared Master | What audience hears |
| Workspace Bleed | Global: Off / Low / Full (default Low) |
| Clip Preview | Private audition, never replaces master |

## Drag library boundaries

- **interact.js** — spatial snap, arrangement, exchange zones, dock mapping
- **sortablejs** — ordered queue lists only

## Recording / demo

- Visible actions must eventually affect real playback (Phase 4)
- Phase 3 shell may use representative dummy data
- GSAP is visual only; Tone is musical clock
