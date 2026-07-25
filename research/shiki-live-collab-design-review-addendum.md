# Shiki Live-Collab · Mid-Run Design Review Addendum

Date: 2026-07-25
Reviewer role: mid-run design review (evaluate-first, per owner addendum)
Review target: `rewrite/collaborative-studio-v2` @ `65f9cca`
Original pack SHA verified unchanged: `85fafb0a95d81f92e87e26a4941fbdd4dff783bc6c5d0743e1f6019cd7def7af` (both `public/` and `docs/` copies)

> **Disclosure — commit landed before owner override.** Under the addendum's original
> bounded-corrections authorization, one correction was implemented and committed as
> `d4e7754` (re-source `kai-rh-lift-4`, arrangement RH swap, duplicate-guard tests,
> inventory doc) **before** the "decision table only" override arrived. It has not been
> pushed and is cleanly revertible (`git revert d4e7754`). All findings below are stated
> against `65f9cca`; the `d4e7754` delta is marked explicitly where relevant.

---

## 1. Decision table (12 topics)

| # | Topic | Decision | Evidence | Current implementation impact | Action |
|---|-------|----------|----------|-------------------------------|--------|
| 1 | Performance groups vs participant identity | **ACCEPT WITH MODIFICATION** | Audio/domain routing keys off group ids `rhythm/keys/horns/guitar` only: `DeskBusId` (`src/types.ts:115`), `DESK_GRAPH` (`src/audio/mixApplication.ts:22-52`), `SET_DESK_BUS` (`src/shell/domain/shellTypes.ts:138`). Cast names (Ryo/Kai/Mei/Ren) exist only in the derived pack's `participants[]` block and as unit-id prefixes (`scripts/generate-live-collab-pack.mjs:184-189`), plus `HORN_HOOK_UNIT_IDS` constants (`src/domain/liveCollabPack.ts:79-92`). **No runtime code loads the derived pack yet** — only tests reference it. | None today; the preferred model (group = routing, cast = presenter config) is already ~true in code. Coupling is data-level only. | When Phase 5 presenter config lands (WP5.2), move `participants[]` out of the pack (or mark it `demoDefaultCast`). Do **not** rename unit-id prefixes now — migration cost if ever needed is small (regenerate + rename 2 constants + 3 test refs). No refactor for purity. |
| 2 | Meaning of "collapse" | **ACCEPT** | `collapseEvents(primaryDraftId, maxBars)` copies events from ONE explicitly named canonical draft (`generate-live-collab-pack.mjs:86-89`); every `build()` in `UNIT_SPECS` names its representative. No averaging/merging/interpolation anywhere. Determinism verified: generator run twice → byte-identical output, matching the committed pack (SHA `aabd903b…`). | Safe as implemented. | None. Do not rewrite. |
| 3 | Palette size | **ACCEPT WITH MODIFICATION** | 20 nominal units, but at `65f9cca` only **18 are musically distinct**: `kai-rh-pad-4` == `kai-rh-lift-4` and `ren-comp-2` == `ren-comp-lift-2` are **byte-identical event lists** (jaccard 1.00 incl. velocities; `artifacts/live-collab-review/pack-analysis.txt`). Root causes: lead-a RH bars 0–4 are identical to entry RH; all six 36-note guitar drafts are one figure and the "second cluster" (37 notes: lead-d/instr-b/return-b) differs by a single note at bars 6–7. Coverage otherwise good: 33/80 source drafts referenced, all 20 units placed in the 13-section arrangementMap, outro motif lossless (source outro-alto is literally one 4-bar motif ×4). | Two launch slots would sound identical in the demo — directly triggers the "fake collaboration" risk (design doc risk #5). | RH pair: fixed in `d4e7754` (lift re-sourced to `midi-interlude-piano-rh`, the only genuinely dense RH material; 6→20 events; placed only in `interlude`, faithful to source) — owner: accept or revert. Guitar pair: **no honest distinct source material exists**; owner decision — drop to 19 units, or keep as a separate launch slot whose lift character comes from live drive/presence. 19–20 is the right size; no additions needed. |
| 4 | Thin performance-group bus | **ACCEPT** | Desk bus commit (`1326981`) added per desk: `Volume` + lowpass `Filter` (default 12 kHz ≈ transparent) + delay-send `Gain` + reverb-send `Gain`, all feeding the **single shared** delay/reverb engines (`masterAudioGraph.ts:384-455`). No per-desk drive chains, compressors, or duplicate FX engines. This matches the authorized §4 spec ("gain, mute, insert filter/drive, send levels"); existing track inserts (drumFilter/drumDrive/guitarDrive/reedPresence) retained upstream. | Not over-built. One flag for the listening test: horns/guitar desk gains also flow into the legacy `melodyFilter→melodyGain` chain which has its own global delay/reverb sends (`masterAudioGraph.ts:443-458`) — a second, global send path on top of desk sends. Potential FX mud, not a defect. | No trim. Listen for horn delay doubling at the checkpoint; if muddy, zero the global `delaySend` contribution for reeds/guitar as a later bounded tweak. |
| 5 | Desk terminology | **ACCEPT WITH MODIFICATION** | "Desk" appears in domain/audio as `DeskBusId`/`deskBus`/`SET_DESK_BUS` — semantically it is a **musical routing group**, not product ownership. Cast/desk-ownership pairing lives only in derived-pack data and demo docs. Dock/device mappings (`dockMixSync.ts:13-17`, `musicalDomain.ts:400-404`) are demo config. | Terminology is contained; no ownership semantics leak. Renaming types now would churn 8+ files for zero ambiguity removed. | Adopt glossary in docs: *performance group* (routing, = current `desk`), *participant/cast* (presenter config), *clip provenance* (`provenance.method` + `sourceDraftIds`, already in schema). Optional `DeskBusId → PerformanceGroupId` rename: DEFER to a natural Phase 5 touchpoint. No new abstraction layers. |
| 6 | Loop boundary metadata | **ACCEPT (schema sufficient today)** | Tick-accurate scan of all 20 units (durations are `"NNNi"` ticks, 768/bar): **zero events cross their unit's loop boundary**; no pickups before bar 0; longest tails end ≥1 tick inside the window (`pack-analysis-after-correction.txt`). One-shots correctly flagged `loop:false` (`ryo-break-4`, `mei-alto-trade-8`). `mei-alto-trade-8` has an intended 1.5-bar leading rest (call placement), safe because it is one-shot. | No truncated pickups, cut tails, stuck notes, or forever-looping fills are possible from the data as generated. **No runtime consumes the pack yet**, so no metadata is currently "needed by the runtime". | Add nothing now. When WP5.1 defines launch semantics, add `maxRepeats?: number` (e.g. outro ×4) if the presenter script needs it — one field, additive. |
| 7 | Verbatim phrase policy | **ACCEPT** | Independent comparison script (`artifacts/live-collab-review/analyze-pack.mjs`): all 4 verbatim horn units match source drafts **exactly** on bar/step/pitch/duration/velocity/instrument (61/57/61/58 notes, 0 mismatches). `mei-outro-4` (extract) drops 27/36 source notes, but the source is verifiably the same 4-bar motif repeated ×4 → 4-bar loop is lossless. Layer model as implemented: (1) immutable source pack, SHA-gated at generator entry (`generate-live-collab-pack.mjs:16-20`); (2) derived unit — deterministic extract/collapse/verbatim/mutate-fork; (3) live playback transform — desk gain/mute/filter/sends, lane mute, launch velocity scale clamped 0.05–2 (`audioEngine.ts:460-479`), none of which mutate pack data; (4) forked revision — generation-time `mutate-fork` only (`ren-fork-alt-2`, 3 notes altered). | Sound. Note: the whole source pack is velocity-flat at 0.6299 (transcription artifact), so live "velocity crescendo" moves operate on relative scaling only. | None required. |
| 8 | One-shot and repetition policy | **ACCEPT WITH MODIFICATION** | `loop:false` = one-shot, correctly applied to the interlude break and alto trade ("never loop trade" honored in data). Loop-forever vs ×N is **not** expressible in schema; outro ×4 and call-response pacing currently live in the (future) presenter script. | Adequate for a scripted demo; under-specified if launch UX ever becomes free-form. | Recommend explicit repetition rules at WP5.1: `maxRepeats` on units + presenter-script authority for call/response ordering. Schema change deferred until there is a consumer. |
| 9 | Chorus | **DEFER (Phase 5 polish / WP-L5)** | `harmonyChorus`/`melodyChorus` are `Tone.Gain(1)` pass-throughs (`masterAudioGraph.ts:178-180`); pack `chorusWet` is stored but inert. Keys desk already gets width via delay 0.15 / reverb 0.20 sends. Rendered keys sample exists for ear-judgment: `08-derived-kai-rh-pad-4-looped-x4.wav` (representative synth timbre, not app graph). | No behavior gap in the current listening-prototype scope. | Do not wire now. Owner judges narrowness at the listening checkpoint; if narrow, WP-L5 (S–M) as scheduled. |
| 10 | Musical-material gate before presenter choreography | **ACCEPT** | No Phase 5 presenter work started (confirmed: no cursor overlay/`SET_PARTICIPANT_PROJECTION`/launch-slot code in `src/shell`). Palette defects found by this review (topic 3) are exactly the class of problem an ear test catches — cursors/Follow/captions (WP5.2–5.5) built on a failed palette would be wasted. | Ordering: owner listening checkpoint → then WP5.2–5.5. **WP5.1 (domain-only progressive lane launch) can safely parallelize**: it consumes arrangement placements and lane identity, not palette aesthetics, and is gated by its own payoff-equivalence test. | Gate WP5.2–5.5 on the listening checkpoint; optionally start WP5.1 in parallel. |
| 11 | Canonical source protection | **ACCEPT** | Re-verified this session: original SHA unchanged (`shasum` on both copies); generator opens source read-only and refuses on SHA mismatch, writes only the derived path; derived pack declares `derivedFrom{packId, packSha256}` (asserted by test); no `local-reconstruction/`/private-pack strings in derived JSON (asserted by test); tests re-run green. | Fully protected. | None. |
| 12 | Evaluation method — listening evidence | **ACCEPT WITH MODIFICATION (partially delivered)** | 14 WAV comparisons rendered headlessly (Tone.Offline in Chrome via `capture-review-renders.mjs` + `render-harness.html`) before the owner override stopped work: source-vs-derived-vs-looped-vs-desk-transformed themeA chain (01–04), collapsed drums source-vs-derived (05–06), break one-shot (07), looped keys (08), corrected RH lift (09), guitar duplicate pair + fork (10–12), trade one-shot (13), opening ensemble (14). **Honest caveats:** representative synths shared by both sides of each comparison (isolates MIDI material; NOT the app master-graph timbre — no runtime consumer of the derived pack exists to tap), file 15 (lead-a 16-bar ensemble) and `render-manifest.json` were not written (run interrupted by the override), and file 09 reflects the `d4e7754` pack. MIDI-diff evidence: `pack-analysis.txt` (@65f9cca) and `pack-analysis-after-correction.txt` (@d4e7754). | Sufficient for the owner to judge topics 3, 6, 7, 8, 9 by ear plus MIDI diff. | If app-timbre evidence is required, rerun after WP5.1 gives the runtime a derived-pack path. |

---

## 2. Status report (9 items)

1. **Branch / HEAD / tree**: `rewrite/collaborative-studio-v2` @ `d4e7754` (= `65f9cca` + one bounded correction committed before the override). Tracked tree clean; untracked review artifacts under `artifacts/live-collab-review/` (git-ignored).
2. **Completed before addendum**: `e073e87` (docs authorization), `cbceb7f` (derived pack generator + integrity tests), `1326981` (four-desk bus into shared delay/reverb), `65f9cca` (launch velocity scale + lane mute). Targeted tests 24/24 at `65f9cca`; 27/27 at `d4e7754` (3 added guards).
3. **In progress**: nothing. Listening-artifact run was interrupted at file 15 of 15 by the owner override; no processes left running.
4. **Irreversible decisions**: none. Original pack byte-identical; derived pack regenerable from a deterministic script; `d4e7754` revertible with `git revert d4e7754`.
5. **Generated palette count**: 20 nominal units. Distinct sounding material: **18 @ `65f9cca`**, **19 @ `d4e7754`** (RH duplicate fixed; guitar duplicate remains, guarded by test as the sole allowed pair).
6. **Units to add / remove / replace**: replace `kai-rh-lift-4` source (done in `d4e7754` — accept or revert); remove **or** explicitly justify `ren-comp-lift-2` (byte-identical to `ren-comp-2`; source has no honest guitar lift — owner decision: 19 units vs keep-as-slot with live drive/presence character); no additions needed; `maxRepeats` metadata deferred to WP5.1.
7. **Ready for owner listening test**: **yes, with caveats** — 14/15 WAVs rendered with representative timbres (not app master-graph sound design); ensemble payoff sample (file 15) missing.
8. **Listening artifact paths** (`artifacts/live-collab-review/`):
   - `01-source-lead-a-alto-8bars.wav` vs `02-derived-mei-alto-themeA-8.wav` (verbatim proof by ear)
   - `03-derived-mei-alto-themeA-8-looped-x2.wav` (looped/launched result)
   - `04-derived-mei-alto-themeA-8-desk-transform.wav` (velocity 0.72 + delay send 0.45 + reverb send 0.25)
   - `05-source-trade-drums-8bars.wav` vs `06-derived-ryo-groove-4-looped-x2.wav` (collapsed drums judgment)
   - `07-derived-ryo-break-4-oneshot.wav` · `13-derived-mei-alto-trade-8-oneshot.wav` (one-shot policy)
   - `08-derived-kai-rh-pad-4-looped-x4.wav` (keys narrowness / chorus judgment)
   - `09-derived-kai-rh-lift-4-looped-x2.wav` (corrected lift material, @d4e7754)
   - `10-derived-ren-comp-2-x2.wav` vs `11-derived-ren-comp-lift-2-x2.wav` (identical pair evidence) vs `12-derived-ren-fork-alt-2-x2.wav` (fork bite)
   - `14-derived-opening-section-8bars.wav` (sparse opening ensemble)
   - MIDI-diff evidence: `pack-analysis.txt`, `pack-analysis-after-correction.txt`, `analyze-pack.mjs`, `render-harness.html`, `capture-review-renders.mjs`
9. **Recommended next step**: owner listening checkpoint on the artifacts above, then two decisions — (a) accept or revert `d4e7754`, (b) drop vs keep `ren-comp-lift-2`. After that, WP5.1 (domain-only lane launch) may start; WP5.2–5.5 stay gated on the ear test.

---

---

## 3. Owner listening verdict (2026-07-25)

**Verdict:** Owner listened to `artifacts/live-collab-review/` samples — **「覺得很好」** (palette / material direction approved).

| Item | Owner decision |
|------|----------------|
| Palette / material direction | **Approved** — proceed with WP5.1 |
| Synth tuning (`soundDesign` / `masterAudioGraph`) | **Deferred** to post-WP5.1 polish pass (WP-L5); not blocking WP5.1 |
| `d4e7754` kai-rh-lift-4 interlude fix | **Keep** (HEAD already at `d4e7754`; no revert) |
| `ren-comp-lift-2` duplicate of `ren-comp-2` | **Pending** — drop to 19 units vs keep as fork-slot placeholder; see §4 escalation |

**Review addendum synthesis:** Treat palette as OK to proceed; synth micro-tune = WP-L5 / post-payoff polish.

---

## 4. Pending owner decisions (WP5.1 gate)

| # | Topic | Status | Default if unspecified |
|---|-------|--------|----------------------|
| B | `ren-comp-lift-2` byte-identical to `ren-comp-2` | **OPEN** | Do not drop or rename without owner — WP5.1 uses pack as-is; report lists options |

---

ECHLUB LIVE-COLLAB REVIEW COMPLETE — WP5.1 AUTHORIZED (palette approved; item B open)
