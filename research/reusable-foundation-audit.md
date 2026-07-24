# Reusable Foundation Audit

Baseline: `4a18901`. Archive branch adds domain modules worth evaluating separately.

## Keep — audio and musical clock

| Module | Reuse | Notes |
|--------|-------|-------|
| `src/audioEngine.ts` | **Yes** | Tone transport, scene material scheduling, mix application |
| `src/audio/masterAudioGraph.ts` | **Yes** | Shared Master graph |
| `src/audio/mixApplication.ts` | **Yes** | Mix param patches |
| `src/audio/voicePlayback.ts` | **Yes** | Voice rendering |
| `src/musicalPosition.ts` | **Yes** | Bar/beat position |
| `src/mixMapping.ts` | **Yes** | Fader/effect mapping |
| `src/sceneTransaction.ts` | **Internal adapter** | Scene data for public pack compatibility — not visible UI |
| `src/sceneExecution.ts` | **Internal adapter** | Same |

## Keep — domain and pack

| Module | Reuse | Notes |
|--------|-------|-------|
| `src/domain/packLoader.ts` | **Yes** | Public pack load |
| `src/domain/reconstructionPack.ts` | **Yes** | Pack schema, validation |
| `src/domain/sessionMaterialBank.ts` | **Yes** | Material compilation, fingerprints |
| `src/domain/materialTypes.ts` | **Yes** | Drum/note/harmony content |
| `src/domain/draftAuthorship.ts` | **Yes** | Author display — generalize beyond four brains |
| `src/domain/placeholderPack.ts` | **Yes** | Dev fallback |
| `public/shiki-no-uta.demo.pack.json` | **Yes** | Approved public demo data |

## Keep — offline export

| Module | Reuse |
|--------|-------|
| `src/offline/*` | **Yes** — entire subtree unless export deemed obsolete |

## Keep — runtime infrastructure

| Module | Reuse | Notes |
|--------|-------|-------|
| `src/runtimeState.ts` | **Yes** | Draft/queue state transitions |
| `src/queueLifecycle.ts` | **Yes** | Queue semantics — decouple from scene naming in UI |
| `src/timerRegistry.ts` | **Yes** | Scheduled callbacks |
| `src/executionLog.ts` | **Yes** | Evidence/instrumentation |
| `src/runtimeInstrumentation.ts` | **Yes** | Debug hooks |

## Keep — demo/audio integration (Phase 4)

| Module | Reuse | Notes |
|--------|-------|-------|
| `src/demo/demoController.ts` | **Partial** | Orchestration patterns; strip scene-first presentation |
| `src/demo/demoRuntime.ts` | **Partial** | Runtime wiring |
| `src/demo/liveMutations.ts` | **Yes** | Guided mutation hooks |
| `src/demo/liveStructuralPlan.ts` | **Partial** | Plan structure; not dashboard layout |
| `src/choreographyScript.ts` | **Phase 4 only** | Cursor choreography after shell approval |
| `src/presentation.ts` | **Phase 4 only** | GSAP projection only |

## Archive-only — domain concepts reusable, UI not

| Module (archive branch) | Domain | UI |
|-------------------------|--------|-----|
| `clipExchangeCoordinator.ts` | **Extract lifecycle model** | Rebuild view |
| `mixControlCoordinator.ts` | **Keep slot/binding semantics** | Rebuild dock visuals |

## Discard — presentation (archive branch)

| Module | Reason |
|--------|--------|
| `src/ui/globalStudio.ts` | Dashboard metaphor |
| `src/ui/collaborativeWorkspace.ts` | Dense multi-miniature layout |
| `src/ui/guidedFocusPanel.ts` | Story beats |
| `src/ui/studioShell.ts` | Rejected shell composition |
| `src/ui/participantFocusView.ts` | Card-based participant |
| `src/ui/presenterNavigation.ts` | Rebuild for new IA |
| `src/ui/sortableStudioBindings.ts` | Tied to rejected layout |
| `src/validation/presenterStudio.test.ts` | Dashboard assertions |
| `src/validation/guidedNarrative.test.ts` | Story-beat coupling |

## Keep — validation harness (adapt)

| Module | Action |
|--------|--------|
| `scripts/browser-load-regression.mjs` | Update selectors/routes |
| `scripts/validate-browser-load.mjs` | Keep |
| `src/validation/browserLoad.test.ts` | Rewrite assertions |
| `src/validation/r3BrowserSmoke.test.ts` | Rewrite for shell |
| `vitest.config.ts`, `vite.config.ts` | Keep base config |

## GSAP and Tone boundary (invariant)

- **Tone.js Transport** = musical clock, parameter scheduling
- **GSAP** = visual projection, presenter cursor, panel transitions
- GSAP must never advance musical position or trigger clip activation

## Scene data

Public pack may retain scene definitions. V2 UI treats scenes as internal scheduling fixtures only. Human arrangement UI uses Clips, Launcher, and Shared Master — not named Scene cards.
