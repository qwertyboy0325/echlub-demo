# Reference Study — Pattern Extraction (Not Visual Copy)

## Ableton Live

| Pattern | Extract for EchLub |
|---------|-------------------|
| Session vs Arrangement | Launcher (clip slots) separate from timeline arrangement — maps to Participant Launcher + Global arrangement |
| Clip detail editor | Full-screen editor on demand — maps to Participant Workspace primary surface |
| Return/master bus | Shared Master distinct from workspace preview |

**Do not adopt:** Ableton Scene labels as product primitive.

## Bitwig

| Pattern | Extract |
|---------|---------|
| Launcher / Arranger / Detail separation | One detail editor at a time, full size |
| Modulation routing | Live Control Dock source mapping |
| Clip launcher colors | Exchange state chroma (draft/shared/staged) |

## Figma

| Pattern | Extract |
|---------|---------|
| Collaborator avatars on canvas | Presence strip with activity, not miniature editors |
| Follow mode | Presenter Follow Active — viewport tracks active participant |
| Multiplayer cursors | Optional restrained cursor for demo recording |
| Viewport switch | Presenter jumps to participant without state change |

## Professional mixer / performance surfaces

| Pattern | Extract |
|---------|---------|
| Channel width for faders | Mixer workspace — large touch targets |
| Metering always visible | Shared Master + selected source meters |
| Send/return topology | Workspace Bleed control (Off/Low/Full) |
| Performance pad grids | Step/MIDI input feedback, not abstract cards |

## Hierarchy principles (synthesized)

```text
Global Studio     = who + what shared + what's playing + where in song
Participant WS    = one primary editor + supporting browser/queue
Mixer WS          = fast parameters + Live Control Dock + meters
Exchange          = artifact + queue + lineage (visible in Global, reachable in Participant)
```

## Screen-space allocation heuristic

| Surface | Minimum share at 1440×900 |
|---------|---------------------------|
| Primary editor (Participant) | 60–70% height |
| Shared Clip Exchange (Global) | 25–35% width or 30% height band |
| Live Control Dock (Mixer) | 40–50% width, full slot height |
| Presence / navigation | ≤48px top or 200px side rail |
| Transport | ≤56px — always visible, never dominant |
