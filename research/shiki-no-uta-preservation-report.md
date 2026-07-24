# Shiki No Uta Preservation Report

Evidence report generated from actual repository files. Parsed from `public/shiki-no-uta.demo.pack.json` on branch `rewrite/collaborative-studio-v2` (2026-07-24).

## Summary

| Field | Value |
|-------|-------|
| Pack ID | `shiki-no-uta-cover-public-demo-v1` |
| Public pack path | `public/shiki-no-uta.demo.pack.json` |
| Deploy mirror | `docs/shiki-no-uta.demo.pack.json` |
| SHA-256 (public pack) | `85fafb0a95d81f92e87e26a4941fbdd4dff783bc6c5d0743e1f6019cd7def7af` |
| Schema version | 3 |
| Draft (clip) count | 80 |
| Track count | 7 |
| Total musical events | 3715 |
| Arrangement total bars | 104 |

## Authoritative archive commit

| Role | Commit | Branch / note |
|------|--------|---------------|
| **Historical playback archive** | `1be1206394ab0416a6cd87bc2914a99e59b09576` | `archive/rejected-dashboard-2026-07-24` — rejected Four-Brain dashboard implementation preserved for reproduction |
| Archive branch tip (research) | `0d4e6cf76c86b651a95e37b42629fce3013b2f7f` | Same branch; later research commit |
| First public pack publish | `4e00eb6` | feat(demo): publish Shiki No Uta browser cover |

Archive pack SHA-256 at `1be1206`: `f7845eb617a9ef27e92c1fed86b2a449d8bb94a190fba3d851ef615f2cf7e667`

**Archive vs rewrite (musical):** event counts and per-track fingerprints match current public pack. Full file SHA differs — non-musical pack fields (choreography, scene FX, export metadata) evolved after archive freeze; musical event inventory unchanged at count/fingerprint level.

## Tempo and meter

| Field | Value |
|-------|-------|
| Base BPM | 91.999988 |
| Tempo map | bar 0 → 91.999988; bar 59 → 91.999988 |
| Time signature | 4/4 from bar 0 |

## Musical timestamps

Events are stored in **clip-local** bar/step coordinates (per draft `patternBars`). Arrangement placement is via sections and scene `startBar`.

| Coordinate system | Earliest | Latest |
|-------------------|----------|--------|
| Arrangement (global) | bar 0, step 0 — section `opening` | bar 103 — section `outro` (startBar 88 + 16 bars) |
| Clip-local (all drafts) | bar 0, step 0 | bar 15, step 15 (abs step 251) — longest clip patterns |

Section boundaries (arrangement):

| Section ID | Start bar | Bars |
|------------|-----------|------|
| opening | 0 | 4 |
| entry | 4 | 8 |
| lead-a | 12 | 8 |
| trade | 20 | 8 |
| lead-c | 28 | 8 |
| lead-d | 36 | 8 |
| interlude | 44 | 8 |
| instrumental-a | 52 | 8 |
| instrumental-b | 60 | 8 |
| bridge | 68 | 4 |
| return-a | 72 | 8 |
| return-b | 80 | 8 |
| outro | 88 | 16 |

## Track and clip inventory

### Tracks

| Track ID | Label | Layer | Gain dB | Clips | Event count |
|----------|-------|-------|---------|-------|-------------|
| track-alto | Alto Saxophone | melody | -6 | 10 | 396 |
| track-tenor | Tenor Saxophone | melody | -6 | 11 | 410 |
| track-piano-rh | Piano RH | harmony | -8 | 13 | 576 |
| track-piano-lh | Piano LH | bass | -5 | 12 | 484 |
| track-guitar | Guitar | melody | -6 | 11 | 363 |
| track-bass | Bass Guitar | bass | -5 | 13 | 514 |
| track-drums | Drumset | drums | -2 | 10 | 972 |

### Per-track musical fingerprints (SHA-256 of ordered events)

| Track | Fingerprint |
|-------|-------------|
| track-alto | `8aca581d926c81888ba14275fe4073ec3e42b2001d7dc2ea2eec04a491910b5d` |
| track-tenor | `439eb6d9535aef2050937870dbdccedeacca17feab7a6b28c816c94e0bfc9f0a` |
| track-piano-rh | `9e3707f0bea0250e248a8770858592dbd749dd0372996a5c2ca83d90dda6df2a` |
| track-piano-lh | `eaf480c8649f7efb359691c8382e55fe339ef2f8c5b8253e48d5c58bd46c30db` |
| track-guitar | `84c4907ae969fd94f45dc18a3a382e08a4fc39fb845912c8f1c44891dbbc44a8` |
| track-bass | `0dcc7038e08121d41f57c1bff4b871bd7884f99bafcd3fb15d73d69c566a9a61` |
| track-drums | `9fd219257df6dc7e34a4a36b7c134ee3883f5703c91b55b1aa6316ebf22bf384` |

All 80 clips at revision `0`. Clip IDs span `memory-opening`, `midi-opening-*`, section-prefixed `midi-{section}-{part}` through `midi-outro-*`.

## Instrument and effect assignments

### Note-level instruments (MIDI-derived)

- `default` — piano, bass, guitar harmonic content
- `guitar`
- `reed-alto`
- `reed-tenor`

### Sound design presets (pack-level)

| Layer | Generator / source | Notable settings |
|-------|-------------------|------------------|
| master | bus | filterRolloff -24, delay 8n, reverb decay 2.1s, compressor -10 dB / 1.5:1 |
| drums | synthesized kit | kick/snare/hat decay, drive 0.02, filter 9600 Hz |
| bass | triangle synth | volume -14, filter base 110 Hz, envelope ADSR |
| harmony | triangle synth + chorus | volume -20, chorus wet 0.06 |
| melody | triangle synth + chorus | volume -15, chorus wet 0.05 |
| texture | brown noise | volume -29, slow envelope |

### Default mix

| Parameter | Value |
|-----------|-------|
| filter | 6400 |
| delayWet | 0.08 |
| reverbWet | 0.12 |
| masterGain | 4 |
| faders.groove | 70 |
| faders.harmony | 52 |
| faders.melody | 76 |
| faders.texture | 0 |

Per-scene FX overrides exist on all 13 scenes (opening through outro).

## Export compatibility

| Capability | Status |
|------------|--------|
| Schema | `reconstructionPack` v3 — validated by `parseReconstructionPackJson` |
| Offline render | 104-bar canonical plan; 1664 scheduling steps (16 steps/bar) — `offlineRender.test.ts` |
| WAV export | Uses `buildCanonicalRenderPlan`, `canonicalOfflineRenderer`, post-process worker |
| Render manifest | Includes `packId`, `packSha256`, `totalBars`, `musicalDurationSeconds` |
| GitHub Pages | `docs/shiki-no-uta.demo.pack.json` mirrors public pack (same SHA-256 as of this report) |
| Legacy loader | `src/legacy/fourBrainMain.ts` fetches `shiki-no-uta.demo.pack.json` from document base URI |

Public pack provenance declares MIDI-only authority: no PDF, MP3, screenshot, or prior transcription as musical source.

## Private-artifact exclusion result

### Private pack path

`local-reconstruction/shiki-no-uta.midi-only.pack.json`

| Check | Result |
|-------|--------|
| File exists in worktree | **No** — owner-local only; path gitignored |
| Listed in `.gitignore` | **Yes** — `local-reconstruction/` |
| Tracked by git | **No** — `git ls-files` returns no `local-reconstruction` or `midi-only` paths |
| Present under `public/` | **No** |
| Post-build `docs/` + `dist/` grep | **Clean** — no `local-reconstruction/`, `midi-only.pack`, or private pack id (2026-07-24 build) |
| Embedded in public pack JSON | **No** — no private paths or `shiki-no-uta-midi-only-private-v1` id |
| Referenced in runtime sources | **No** — `main.tsx`, `fourBrainMain.ts`, audio graph, export controller exclude `local-reconstruction/` |
| Script references only | `scripts/generate-midi-only-cover.mjs`, `scripts/promote-public-song-pack.mjs`, `scripts/capture-private-sax-audition.mjs` — path constants only, no content copy |

### Allowed script/test references (non-public)

- `src/validation/offlineRender.test.ts` — optional private pack load; skips when absent
- `src/validation/stylizationUnlock.test.ts` — optional private pack
- `src/validation/audioEvidencePolish.test.ts` — optional private pack

No `.gitignore` change required — private path already excluded.

## Automated integrity coverage

| File | Purpose |
|------|---------|
| `src/validation/shikiPackIntegrity.ts` | Read-only semantic snapshot builders |
| `src/validation/shikiPublicPack.test.ts` | Pack identity, tempo, counts, fingerprints, clip revisions, track assignments, sections, private boundary |
| `src/validation/publicSongForm.test.ts` | End-to-end runtime materialization from public pack |

Run: `npm run test`

## Gaps blocking Phase 4 musical gate

1. **Runtime A/B playback evidence** — archived vs rewrite comparison not yet captured (Phase 4 gate steps 1–3).
2. **Rewrite adapter integration** — new React shell must load and perform public pack (step 2 unverified).
3. **Restart/replay verification** — not executed (step 6).
4. **Post-build dist grep** — **Clean** on 2026-07-24 (`npm run build`; no private paths in bundle output).
5. **Private pack local presence** — optional for owner-local stylization tests; absence does not block public preservation but limits private-pack regression tests locally.

Static preservation gate: **met**. Runtime musical completion gate: **not met**.
