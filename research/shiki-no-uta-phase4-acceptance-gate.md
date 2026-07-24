# Shiki No Uta Phase 4 Acceptance Gate

Musical completion gate for the EchLub rewrite. Distinct from the visual shell gate (Phase 3B).

## Prerequisite artifacts

- [ ] `research/shiki-no-uta-preservation-report.md` populated from actual pack contents
- [ ] `src/validation/shikiPublicPack.test.ts` passing in `npm run test`
- [ ] Private boundary audit clean (see preservation report § Private-artifact exclusion)

## Seven verification steps (owner binding)

Before the rewrite is allowed to **claim musical completion**:

| # | Step | Evidence required |
|---|------|-------------------|
| 1 | Run the archived Shiki no Uta version | Checkout `archive/rejected-dashboard-2026-07-24` @ `1be1206`; load public pack; capture playback |
| 2 | Run the rewrite using the same approved public material | `rewrite/collaborative-studio-v2`; load `public/shiki-no-uta.demo.pack.json`; capture playback |
| 3 | Capture comparable playback evidence | Side-by-side or sequential recordings with matched transport start, duration, and section boundaries |
| 4 | Verify all intended musical parts are present | Alto, tenor, piano RH/LH, guitar, bass, drums — all 7 tracks audible in correct sections |
| 5 | Verify no obvious note, timing, velocity or assignment loss | Compare against preservation report fingerprints; no silent part drops |
| 6 | Verify restart and replay | Stop → reload → replay produces same musical result (no stale graph or missing clips) |
| 7 | Verify public build contains no private reconstruction source | `npm run build`; grep `dist/` and `docs/` for `local-reconstruction/`, `midi-only.pack`, private pack id |

## Pass criteria

- Steps 1–7 executed with recorded evidence (not inferred)
- Integrity tests green on CI/local `npm run test`
- Any adapter gap documented as **incomplete integration**, not hidden by score regeneration

## Fail criteria (stop and report)

- Missing track or section in rewrite playback
- Note count or fingerprint drift without owner-approved pack revision
- Private pack path or content in public/deploy artifacts
- Regenerated or approximated score substituted for preserved material

## Current gate status (2026-07-24)

| Step | Status |
|------|--------|
| 1 — archived playback | **Not executed** (requires archive branch run) |
| 2 — rewrite playback | **Partial** — adapter wired; runtime recording not captured |
| 3 — comparable evidence | **Not captured** |
| 4 — all parts present | **Unverified** |
| 5 — no musical loss | **Partial** — static pack integrity + domain edit tests pass |
| 6 — restart/replay | **Partial** — RESTART_SESSION implemented; runtime replay not recorded |
| 7 — public build private exclusion | **Pass** — docs/dist grep clean (2026-07-24 Phase 4 run) |

**Verdict:** Phase 4 musical gate **partially met**. Core integration implemented; archive A/B runtime evidence still required for full pass.
