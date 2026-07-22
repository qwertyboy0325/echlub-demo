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
