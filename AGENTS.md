# AGENTS.md

Cross-agent entry point for EchLub. This file orients an agent; it does not duplicate canonical documents.

## What EchLub Is

- EchLub is an exploratory music-collaboration prototype lab.
- The Four-Brain DJ Lab is a scripted, recordable concept demo — not production DAW semantics.
- Tone.js Transport is the musical clock authority.
- The performance script is the semantic decision authority.
- GSAP is visual projection only.

## Required Reading Order

1. `README.md`
2. Applicable rules under `.cursor/rules/`
3. Applicable agents under `.cursor/agents/`
4. Canonical source for the active prototype (`src/`, `package.json`)

## Authority Order

1. Active bounded work package
2. Owner's latest explicit instructions
3. This file, `CLAUDE.md`, `.cursor/rules/**`, `.cursor/agents/**`
4. Actual code, tests, package manifests, and Git state
5. Prototype documentation and evidence artifacts

Actual code, diffs, tests, browser behavior, and generated artifacts override agent self-assessment.

## Model Roles

| Role | Default model | Authorization |
|------|---------------|---------------|
| FAST_EXECUTOR | Composer 2.5 Fast | Default for implementation |
| SPECIALIST_REVIEWER | Fresh context, read-only | When work package authorizes |
| STRONG_ARCHITECT | — | Deny by default; requires explicit package authorization |
| STRONG_FINAL_CONFLICT_REVIEW | GPT-5.6 Sol High | Deny by default; requires explicit owner authorization |

## Git Policy

Unless explicitly authorized in the active work package:

- no staging, commit, push, merge, rebase, reset, restore, stash, tag, or branch deletion

## Proof Of Behavior

Do not claim runtime behavior that has not been verified. Distinguish implemented, visually observed, inferred, and unverified claims.

## Cursor Cloud specific instructions

- Stack: Vite 7 + TypeScript, no framework, single frontend service. Commands live in `package.json` (`dev`, `build`, `typecheck`, `test`). No lint script exists; `npm run typecheck` (`tsc --noEmit`) is the closest static check.
- Dev server: `npm run dev` serves on port `4173`. Root `/` loads the main Round 2 app (`src/main.ts`); the Four-Brain DJ Lab concept demo is served at `/standalone/`.
- Browser tests/scripts: `npm test` includes two Puppeteer smoke tests (`browserLoad.test.ts`, `r3BrowserSmoke.test.ts`) plus the `scripts/*.mjs` capture/validate tools. They launch Chrome via `puppeteer-core` and default `executablePath` to a macOS path. On this VM you MUST set `CHROME_PATH=/usr/bin/google-chrome-stable`, e.g. `CHROME_PATH=/usr/bin/google-chrome-stable npm test`. Without it those two tests fail with "Browser was not found"; the other 132 tests pass regardless.
- `npm run build` outputs to the committed `docs/` directory (GitHub Pages site, `emptyOutDir: true`) and rewrites its hashed assets. Do not commit build output — restore with `git checkout -- docs/` and remove stray untracked `docs/assets/*` after building.
