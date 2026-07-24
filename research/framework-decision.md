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

## Decision

**Retain Vite + vanilla TypeScript** for the rewrite shell.

### Rationale

1. Baseline `4a18901` and all reusable audio/domain code are vanilla TS — migration to React/Svelte buys component ergonomics but does not solve the hard problems (MIDI canvas, dock layout, live control sync).
2. Dockview v7 (`dockview` package) provides vanilla-first docking with popouts — the primary layout gap — without React.
3. Owner rejected presentation, not language — a framework swap would delay the shell gate without addressing product failure modes.
4. GSAP and Tone.js integrations are already proven in vanilla modules.
5. Composer can implement faster when conventions match the archived codebase's non-UI layers.

### Third option (narrowly justified)

**Vite + Svelte 5** — credible for reactive UI with smaller bundle, but lacks mature docking library parity with Dockview and forces full rewrite of working domain imports. Rejected unless owner prioritizes Svelte.

### React rejection (for this project)

Do not migrate to React merely for component libraries. Custom DAW surfaces (piano roll, step grid, mixer) will be canvas/SVG-heavy regardless. React adds reconciliation cost in high-frequency parameter updates unless carefully isolated.

## Implications for Phase 3

- Add `dockview` (vanilla) as production dependency after skeleton approval
- Keep Vitest; add Playwright for shell gates (optional MCP or npm)
- No JSX/TSX in canonical `src/` unless owner overrides

## Stale rule note

README and AGENTS still describe "one-page" Four-Brain architecture — framework decision does not extend that metaphor.
