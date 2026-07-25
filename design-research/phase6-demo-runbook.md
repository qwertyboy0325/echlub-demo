# Phase 6 demo runbook

Owner-runnable steps for the live-collab presenter demo. No agent required.

## Prerequisites

```bash
npm install
```

Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (or set `CHROME_PATH`).

## Live-collab pack SHA

The derived pack is served from `public/shiki-no-uta.live-collab.pack.json`.

```bash
shasum -a 256 public/shiki-no-uta.live-collab.pack.json
```

Current oracle (regenerate after intentional pack edits):

```text
005e38688523ad7b7e7035244d909522a8be7a30cabc4d8b30ce0578428bed58
```

Do **not** mutate `shiki-no-uta.demo.pack.json` (preservation oracle).

## Interactive demo (`/present`)

1. Start dev server:

   ```bash
   npm run dev:live-collab
   ```

2. Open the URL Vite prints (typically `http://localhost:4173/present`).

3. Click **Play** once to unlock AudioContext.

4. Click **Run demo** (or restart). Walkthrough is **40 beats**: create → save to private library → share → fork → review → revise → compare → accept → stage → seven-lane payoff → perform → recall → audition → promote → launch → restart.

5. Optional manual controls: **Pause walkthrough** in presenter chrome; Exchange **Revise** / **Listen Parent·Fork** on the bass fork compare panel; Ready forks show **Fork audition** before Promote.

## Private vs Shared (cold-viewer check)

Without reading the caption strip, confirm:

- Global zones: **Workspaces** · Arrangement · Shared Master (not a multiplayer session lobby)
- Participant zones: **Private workspace** · possessive desk name · Shared Master dimmed
- Create header: **Private desk** badge + clip name + mode legend
- Create toolbar: **Desk preview** + hint `local only · not Shared Master`
- Participant room: audition banner while cue is active
- Global zones: **Desk preview · local** chip appears beside dimmed Shared Master during cue
- Presence: live task e.g. `Kai · editing LH` (not only desk name)

## Capture (A/V artifact)

Attach to an existing server or let the script spawn one:

```bash
npm run capture:phase5-demo
```

Outputs under `artifacts/phase5-demo/`:

- `phase5-narrative-walkthrough.mp4`
- `phase5-narrative-walkthrough.webm`
- `manifest.json` (git HEAD + file hashes)

Use a free port if 4173 is busy:

```bash
PHASE5_PORT=4174 npm run capture:phase5-demo
```

Foreground Chrome (debug timing):

```bash
HEADLESS=0 npm run capture:phase5-demo
```

**Not a CI gate.** Full A/V capture (~2–4 min) is owner/local only.

## Validate capture (no re-record)

```bash
npm run validate:phase5-demo
```

Checks manifest, lane trace, and artifact presence. Does not run full vitest.

## CI / light smoke (no full capture)

```bash
npm run validate:browser
```

Spawns a short-lived Vite server, loads the shell, clicks through Three Rooms, asserts FocusShell / Presence / Exchange mount with `pageErrors=0`. Explicitly **excludes** the ~134s Phase 5 A/V capture.

`npm test` (vitest) also **excludes** browser smoke wrappers (`browserLoad.test.ts`, `r3BrowserSmoke.test.ts`); run those only via `validate:browser` / the smoke scripts.

Legacy HTML `#start-button` probe lives at `scripts/validate-browser-load.mjs` (Four-Brain path only; not wired as `validate:browser`).

## Tests (before capture)

```bash
npm test
```

Excludes browser smoke by default. Targeted:

```bash
npx vitest run src/validation/wp6ReviewDepth.test.ts src/validation/wp6PrivateForkBoundary.test.ts
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank page | Use exact Vite URL; for preview use `/present` path |
| No audio | Click Play or Desk audition first |
| Capture attach fails | `PHASE5_ATTACH_ONLY=1` requires server already up on `PHASE5_PORT` |
| Port clash | `PHASE5_PORT=4174 npm run dev:live-collab` then capture with same port |
| CI smoke port clash | `BROWSER_LOAD_PORT=4184 npm run validate:browser` |
