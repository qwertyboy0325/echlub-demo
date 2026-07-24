# Framework Decision — EchLub V2

## Candidates compared

| Criterion | Vite + vanilla TS | Vite + React | Vite + Svelte 5 |
|-----------|-------------------|--------------|-----------------|
| Full-size professional workspaces | Good with Dockview vanilla | Good with dockview-react | Good; smaller ecosystem for docking |
| Docking / popouts | **Dockview v7 native** | dockview-react first-class | No first-class dock lib |
| Complex shared state | Manual but existing patterns | Context/reducer ecosystem | Runes/stores — migration cost |
| Audio isolation | **Direct Tone.js** (current) | Same; extra React render layer | Same |
| Interaction perf (MIDI editor) | **Canvas/DOM direct** | Reconciliation overhead in dense editors | Good but team unfamiliar |
| Testability | Vitest + jsdom (current) | + Testing Library | + @testing-library/svelte |
| Visual prototyping speed | Moderate | Fast with component libs | Fast |
| Long-term replacement cost | Lowest (baseline) | High migration | High migration |
| Bundle size | **Smallest** (~no framework) | +40–80 KB gzip React | +15–25 KB Svelte |
| Accessibility | Manual on custom controls | Radix/shadcn available | Limited audio UI libs |
| Composer/subagent reliability | **Matches existing codebase** | More files, more boundaries | New conventions |

## Decision status: **OWNER GATE — split verdict**

| Researcher | Recommendation |
|------------|----------------|
| Prior orchestrator | **Vite + vanilla TS** |
| [Sol framework/library research](4402ecad-84a2-4e65-a86b-73a0a5e91d11) | **Vite + React + TS** |

See `design-research/strong-model-synthesis.md` for full reconciliation.

### Vanilla TS path (orchestrator provisional)

1. Baseline `4a18901` and reusable audio/domain are vanilla TS — no migration tax.
2. Dockview v7 (`dockview` package) provides vanilla-first docking.
3. Smallest bundle; matches archived non-UI modules.
4. Risk: manual lifecycle across three workspaces (Sol's concern).

### React path (Sol)

1. Component ownership maps to workspace/panel/exchange/dock boundaries.
2. `@dnd-kit`, `dockview-react`, Floating UI, Testing Library ecosystem.
3. Tone/audio as injected service; transport ticks via rAF — React never schedules music.
4. Risk: migration cost; render-frequency discipline required.

### Third option (narrowly justified)

**Vite + Lit** — Sol's credible #2; custom elements for controls. Rejected unless framework independence is strategic.

**Vite + Svelte 5** — rejected; weak docking ecosystem.

## Owner must choose before Phase 3A

- [ ] `framework: vanilla` — dockview, interact.js, sortablejs, CSS Grid shell
- [ ] `framework: react` — dockview-react, @dnd-kit, external domain store

## Implications by path

**Vanilla:** `dockview`, `interactjs`, `sortablejs`, `@floating-ui/dom` after approval. No JSX in `src/`.

**React:** `react`, `react-dom`, `dockview-react`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@floating-ui/react`. Rewrite worktree bootstrap from approved skeleton.

## Stale rule note

README and AGENTS still describe "one-page" Four-Brain architecture — framework decision does not extend that metaphor.
