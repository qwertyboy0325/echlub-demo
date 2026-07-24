# Rejected Patterns — Must Not Return

Source: owner rejection, `archive/rejected-dashboard-2026-07-24-FAILURE-NOTE.md`, layout audits, guided demo evidence.

## Presentation patterns — banned

| Pattern | Evidence | Why it fails |
|---------|----------|--------------|
| Simultaneous miniature participant DAWs | `guided-layout-audit-studio-1440.png` | Implies toy, not professional studio |
| Dense single-screen dashboard | `guided-demo-collaborative-workspace.png` | No room for credible editors |
| Story beat / guided focus panel | `guidedFocusPanel.ts`, walkthrough steps | Explains song instead of showing work |
| Scripted role popups | `choreographyScript.ts` role cards | Permanent identity, not task profile |
| Scene cards as navigation (Entry, Return A…) | `owner-walkthrough.md` steps 4, 10 | Scene-driven storytelling |
| Slideshow progression | `guided-demo-full-run.webm` | Completed-song tour, not live construction |
| Abstract decision cards | comparison/summary surfaces | Hides musical artifacts |
| Four-brain fixed framing | legacy `LEGACY_BRAIN_CAPABILITIES` | Violates N-participant invariant |
| Shrunken editors in responsive layout | `guided-layout-audit-390.json` studio height ~245px | Unreadable at narrow widths |

## Interaction patterns — banned

| Pattern | Replace with |
|---------|--------------|
| Automatic scene launch as product flow | Human clip select → stage → activate |
| Viewpoint change mutating music | Presenter POV is projection-only |
| Drag removing shared artifact | Fork/working copy semantics |
| Single mix of preview/master/bleed | Three distinct audio modes |
| Tiny Live Control parameters | Large snap-based dock slots |

## Technical patterns — do not import into V2 UI

- `studioShell.ts` composition model
- `collaborativeWorkspace.ts` multi-card grid
- `presenterUiState.ts` scene-route coupling
- Layout audit gates asserting dashboard tile geometry

## Patterns that may return in different form

| Pattern | Condition |
|---------|-----------|
| GSAP cursor choreography | Phase 4 only; after shell approval |
| Scene data in pack | Internal adapter only |
| Queue lifecycle | Rebuilt with Exchange-centric UI |
| Mix control coordinator | Domain semantics yes; dashboard projection no |
