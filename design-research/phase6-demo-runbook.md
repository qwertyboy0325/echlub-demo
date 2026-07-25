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

4. The walkthrough auto-runs (36 beats): fork → review → revise (step edit) → compare (Listen A/B) → accept → stage → seven-lane payoff → perform → recall → promote → restart.

5. Optional manual controls: **Pause walkthrough** in presenter chrome; Exchange **Revise** / **Listen A·B** on the bass fork compare panel.

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

## Validate capture (no re-record)

```bash
npm run validate:phase5-demo
```

Checks manifest, lane trace, and artifact presence. Does not run full vitest.

## Tests (before capture)

```bash
npm test
```

Excludes browser smoke by default. Targeted:

```bash
npx vitest run src/validation/wp6ReviewDepth.test.ts
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank page | Use exact Vite URL; for preview use `/present` path |
| No audio | Click Play or Preview clip first |
| Capture attach fails | `PHASE5_ATTACH_ONLY=1` requires server already up on `PHASE5_PORT` |
| Port clash | `PHASE5_PORT=4174 npm run dev:live-collab` then capture with same port |
