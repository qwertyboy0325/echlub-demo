# Framework Decision — EchLub V2

**Status: LOCKED by owner 2026-07-24**

## Decision

**Vite + React + TypeScript** for UI projection. Domain and audio remain framework-independent TypeScript modules.

### Rationale

1. Component boundaries clarify Three Rooms / Focus Shell surfaces without entangling Tone.js lifecycle.
2. `dockview-react`, Testing Library, and a11y primitives accelerate Participant editor groups.
3. Audio, material, and offline modules stay vanilla TS — React mounts views only; no musical authority in React.
4. Transport ticks and parameter writes use external store + scoped subscriptions — no whole-tree rerender on bar advance.

### Boundaries

| Layer | Technology | Authority |
|-------|------------|-----------|
| UI shell | React + TSX | Projection only |
| Domain | Pure TS (`src/shell/domain/`, `src/domain/`) | Commands, lifecycle, follow lock |
| Audio | Tone.js (`src/audioEngine.ts`, `src/audio/`) | Musical clock (not wired Phase 3A) |
| Layout libs | dockview-react (Participant center), interactjs, sortablejs, @floating-ui/dom | Scoped per surface |

### Rejected for Phase 3A

- Vanilla-only shell (prior research) — superseded by owner gate
- Svelte 5 — no mature dock parity
- @dnd-kit — use sortablejs for 1D queue order; interactjs for spatial
- XState — defer until permission/MIDI subgraphs demand it

### Implications

- `src/main.tsx` + `src/App.tsx` replace Four-Brain bootstrap
- `src/legacy/fourBrainMain.ts` parked unimported
- Vitest + jsdom for shell store; puppeteer for browser gates
- JSX allowed in `src/**/*.tsx`; domain modules stay `.ts`

## Historical note

Prior revision recommended vanilla TS + Dockview vanilla. Retained in git history for audit; owner resolved framework conflict in favor of React projection layer.
