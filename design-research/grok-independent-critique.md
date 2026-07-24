# Grok Independent Critique — Cold Viewer Analysis

*Role: Grok 4.5 High — product critic. Independent of implementation.*

## Patterns that MUST NOT survive

1. **Simultaneous miniature DAW grid** — reads as monitoring dashboard, not studio
2. **Story beat / guided focus overlays** — narrator explaining instead of musicians working
3. **Scene-named navigation** (Entry, Return A, Bridge) — telegraphs song structure, removes agency illusion
4. **Role popups** ("Memory / Material", "Pulse / Rhythm") — permanent cast, not task profiles
5. **Slideshow walkthrough rhythm** — one revelation per click, not parallel collaboration
6. **Abstract comparison/summary cards** — hides the Clip as artifact
7. **Responsive strategy of shrinking everything** — 390px layout audits show 245px "studio" height = unreadable
8. **Seven routes with no spatial memory** — presenter gets lost without persistent shell

## Cold-viewer confusion (rejected demo)

| Viewer question | What rejected demo implies (wrong) |
|-----------------|-------------------------------------|
| "Are they making music now?" | No — they're touring a finished arrangement |
| "What's shared vs private?" | Unclear — everything looks equally small |
| "Who did what?" | Role labels, not artifact lineage |
| "What's the main workspace?" | None — everything competes equally |
| "How do I know it's live?" | Scene launches feel automatic/scripted |

## Three skeleton directions (product lens)

### A — Stage & Booths
- **First impression:** "Backstage tour" — cinematic, clear mode separation
- **Collaboration:** Strong via stage activity feed; weak if booth dock too small
- **Screen space:** Excellent for arrangement payoff; teleport cost

### B — Exchange-Anchored Focus Shell (Sol's pick aligns)
- **First impression:** "Figma meets Bitwig" — professional, legible
- **Collaboration:** Exchange always visible — best for handoff narrative
- **Screen space:** Balanced; rails tax editor width

### C — Dual Canvas
- **First impression:** "Trello + DAW" — collaboration obvious, music secondary
- **Collaboration:** Kanban is unmistakable
- **Screen space:** Fails 1280×720 without collapse

## Harsh critique of recommended direction (B)

**Even if B is correct, it will fail if:**

1. **Exchange becomes a text table** — viewers will ignore it. Rows need waveform thumb, color state, contributor avatar, and motion on state change.

2. **Presence rail is decorative** — avatars without live task text ("editing kick pattern") repeat Figma cosplay without substance.

3. **Center panel tab sprawl** — Clip/MIDI/Step/Devices/Automation/Mix/Queue/Launcher/Arrange is nine tabs. Collapse to 5 visible + overflow or use dockview groups, or viewers perceive complexity without capability.

4. **Mixer mode feels bolted on** — if dock only appears in a separate "mode," demo will skip it. Dock should be reachable in one click from any workspace with task profile = Mix.

5. **Follow Active is a gimmick** — if it jumps unpredictably during recording, presenter loses control. Follow must be presenter-toggle with clear "following Alex" banner.

6. **1280×720 presentation** — 25% Exchange + 14% presence = 41% gone before editor. **Mandatory** collapse behavior must be designed now, not patched later.

## Independent recommendation

**B with mandatory collapsible Exchange overlay below 1360px width** and **max 5 primary editor tabs**.

## Demo storyboard (viewer emotional arc)

1. Empty → curiosity
2. First note → "someone is building"
3. Share to Exchange → "oh, it's collaborative"
4. Fork + FX → "another person changed it"
5. Dock sweep → "this is performable"
6. Stage to timeline → "human choice, not autoplay"
7. Master swells → payoff
8. Restart → "clean lab, reproducible"

## Viewport failure matrix

| Viewport | Rejected demo failure | B skeleton risk | Mitigation |
|----------|----------------------|-----------------|------------|
| 1440×900 | Dashboard clutter | Acceptable | Design target |
| 1440×810 | Same | Acceptable | 16:9 presentation |
| 1280×720 | Mini editors illegible | Exchange rail cramped | Collapse Exchange to drawer |
| <768 | Unusable full editors | Must not show mini DAWs | Read-only Global + presence only |

## Final Grok verdict

Option B is the least likely to repeat the rejected dashboard failure **if** Exchange rows are visually musical (not administrative) and narrow-viewport collapse is designed into the skeleton, not deferred.

Do not proceed to implementation without owner explicitly picking B (or A/C with accepted tradeoffs).
