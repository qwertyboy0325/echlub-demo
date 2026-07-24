# Problem Definition — EchLub Collaborative Studio V2

## Product statement

EchLub is presented as a **collaborative music studio** where multiple people build one piece of music through visible artifact exchange, full-size personal workspaces, and human musical judgment — culminating in one Shared Master output.

## Audience

- Presentation/demo viewers (investors, collaborators, musicians)
- Presenter operating viewpoint switches during recording
- Simulated participants with task-profile workspaces (not fixed four-brain identities)

## Core jobs to be visible

1. Create and edit Clips (MIDI, step, devices)
2. Share, fork, claim, revise Clips via Shared Clip Exchange
3. Queue and hand off work publicly
4. Stage and activate Clips in arrangement by human choice
5. Shape Shared Master with effects, automation, Live Control Dock
6. Switch presenter viewpoint without altering collaboration state

## Failure of rejected implementation

Technically functional but communicated the wrong product:

- Dense dashboard with simultaneous miniature DAW cards
- Story beats and role popups explaining a completed song
- Scene-driven progression as primary UI primitive
- Slideshow feel despite passing browser gates

## Success criteria for V2 skeleton

| Criterion | Measure |
|-----------|---------|
| Full-size workspace | One primary editor occupies ≥60% viewport height at 1440×900 |
| Collaboration visible | Exchange + queue readable without opening miniature editors |
| Human arrangement | No required Scene UI; clip activation is explicit |
| Live Control Dock | 6–8 large slots visible in Mixer workspace during playback |
| Presenter clarity | Global / Participant / Follow modes obvious in <3 seconds |
| Desktop-first | 1440×900 primary; 1280×720 check; narrow = reduced Global only |

## Non-goals (this phase)

- Real multi-user networking
- Mobile full DAW
- Production DAW feature parity
- Framework migration to React
- Audio choreography integration

## Owner gates

1. **This document + skeleton approval** — before any implementation
2. **Browser shell approval** — before audio/demo integration
