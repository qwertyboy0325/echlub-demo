# Removal Candidate List — Post-Approval Clean Rewrite

**Do not delete until owner approves skeleton and Phase 3 begins.**

## Remove entirely (rejected presentation)

| Path | Reason |
|------|--------|
| `src/ui/collaborativeWorkspace.ts` | Dashboard composition |
| `src/ui/globalStudio.ts` | Miniature studio cards |
| `src/ui/guidedFocusPanel.ts` | Story beats |
| `src/ui/studioShell.ts` | Rejected app shell |
| `src/ui/participantFocusView.ts` | Card focus pattern |
| `src/ui/participantWorkspacePanels.ts` | Dashboard panels |
| `src/ui/clipExchangeView.ts` | Rebuild on new Exchange IA |
| `src/ui/liveControlDock.ts` | Rebuild larger dock |
| `src/ui/mixControlProjection.ts` | Rebind to new shell |
| `src/ui/presenterNavigation.ts` | Rebuild navigation |
| `src/ui/presenterUiState.ts` | Rebuild state |
| `src/ui/sortableStudioBindings.ts` | Layout-coupled |
| `src/ui/studioInteractionBindings.ts` | Layout-coupled |
| `src/demo/guidedSparseBootstrap.ts` | Guided narrative bootstrap |
| `scripts/capture-guided-demo.mjs` | Rejected demo capture |
| `scripts/browser-participant-layout-audit.mjs` | Dashboard layout audit |

## Remove or rewrite tests

| Path | Action |
|------|--------|
| `src/validation/presenterStudio.test.ts` | Remove |
| `src/validation/participantWorkspace.test.ts` | Remove |
| `src/validation/guidedNarrative.test.ts` | Remove |
| `src/validation/guidedRestart.test.ts` | Rewrite for v2 restart |
| `src/validation/clipExchangeLifecycle.test.ts` | Rewrite against new domain API |
| `src/validation/liveControlDock.test.ts` | Rewrite for new dock |

## Baseline UI to replace (4a18901 worktree)

| Path | Action |
|------|--------|
| `src/ui/appShell.ts` | Replace |
| `src/ui/sessionView.ts` | Replace |
| `src/ui/liveCapabilityWorkspaces.ts` | Replace |
| `src/ui/participantRail.ts` | Replace or merge into presence rail |
| `src/style.css` | Replace wholesale |
| `src/main.ts` | Rewrite entry/bootstrap |
| `src/uiTargets.ts` | Rewrite selectors |

## Safe to remove during rewrite (generated)

| Path | Notes |
|------|-------|
| `docs/assets/index-*.js` | Regenerated on build |
| `docs/assets/index-*.css` | Regenerated on build |

## Never remove

| Path | Reason |
|------|--------|
| `archive/rejected-dashboard-2026-07-24-FAILURE-NOTE.md` | Failure record |
| Git branch `archive/rejected-dashboard-2026-07-24` | Historical reconstruction |
| `artifacts/**` (local) | Private evidence |
| `public/shiki-no-uta.demo.pack.json` | Approved public pack |
| `src/audioEngine.ts` and audio subtree | Musical foundation |
| `src/offline/**` | Export pipeline |
| `standalone/**` | Historical reference (low priority) |

## Stale documentation to update later

| Path | Action |
|------|--------|
| `README.md` | Rewrite after shell gate |
| `AGENTS.md` | Update product description |

## Dependency removals (after shell built)

| Package | Action |
|---------|--------|
| None immediately | sortablejs retained; dockview/interact/floating-ui added post-approval |
