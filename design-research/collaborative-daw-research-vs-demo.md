# Collaborative DAW Research vs EchLub Demo

**Date:** 2026-07-25  
**HEAD inspected:** `cfc8cd5` (`rewrite/collaborative-studio-v2`) — *Make create→library→share visible for cold-viewer /present.*  
**Lens:** [`collaborative-daw-research-context.md`](./collaborative-daw-research-context.md)  
**Evidence:** `src/shell/**`, `src/domain/**`, `src/audioEngine.ts`, `src/features/**`, `src/demo/**`, `presenterWalkthrough.ts`, pack JSON, validation tests, prior design-research notes.

**Authority fence:** This note is research analysis. It does **not** authorize ownership systems, locks, networking/CRDT, all collab modes, Voice AI, plugin host, broad AudioEngine redesign, MaterialRef replacement, or full UI redesign. Separates: research conclusion | recommendation | already-authorized implementation.

---

## A. Current implementation map

### A.1 Domain objects (two stacks)

| Object | Where | Role today |
|--------|-------|------------|
| `MaterialRef` `{draftId, revision, fingerprint}` | `src/domain/materialTypes.ts`, `src/types.ts` | Exact revision pin for scene layers / stacks |
| `ProducedMaterial` + `SessionMaterialBank` | `materialTypes.ts`, `sessionMaterialBank.ts` | Compiled immutable content; resolve requires revision **and** fingerprint |
| `ProductionSession` | `sessionTypes.ts` | Pack-backed song: drafts, scenes, arrangement, liveStructure, performanceConfig |
| `SceneDefinition.layers` / `layerStacks` | `types.ts` | Placement of MaterialRefs (internal; no Scene product UI) |
| `Arrangement` (domain) | `sessionTypes.ts` | Ordered scene refs + totalBars |
| `LiveStructureState` | `sessionTypes.ts` + `demo/liveStructuralMutations.ts` | Live hold/replace/extend/… on a **cloned** session |
| `PerformanceCapability` / `CapabilityAssignment` | `performanceModel.ts` | Live control grouping; decoupled from BrainId |
| `ExchangeClip` | `shell/domain/shellTypes.ts` | Collaboration queue row: lifecycle, fork lineage, revision int |
| `ArrangementSlot` / `TimelineClip` | `shellTypes.ts` | Session-grid lane + projected score-map block |
| `DeskLibraryClip` | `shellTypes.ts` | Private library before Exchange (`SAVE_TO_LIBRARY`) |
| `ShellState` | `shellTypes.ts` | Rooms, follow, exchange, lanes, dock, desk audition, sessionPhase, recallRole |

**Connection (simplified):**

```text
LiveCollabPack / ReconstructionPack
  → ProductionSession (MusicalDomainStore)
  → SessionMaterialBank → AudioEngine
ShellState.exchangeClips / arrangementSlots
  → (live-collab) projectLiveCollabTimelineClips → score map
  → ShellAudioAdapter → MusicalDomainStore lane activate / private cue
```

**Important split:** Shell collaboration lifecycle (`SHARE_CLIP` … `LAUNCH_SLOT`) and legacy `DemoRuntime` acts (`production` → `canonicalPlayback` → `livePerformance` → `comparison`) share types but **do not share one command bus**. Phase 5 presenter path is Shell + MusicalDomainStore; Canonical/Live freeze/compare lives primarily under `src/demo/`.

### A.2 Session ↔ Arrangement

**Research preferred model:** materials → Session projection / Arrangement projection / Performance projection (one truth).

**Demo reality:**

| Mode | Session grid | Arrangement / score map | Musical truth |
|------|--------------|-------------------------|---------------|
| **live-collab** | 7 `ArrangementSlot` lanes | **Projected** from slots (`liveCollabArrangementProjection.ts` — explicit single source) | `MusicalDomainStore.rebuildArrangementFromActiveLanes` rewrites scene layers from active lanes + placements |
| **public / Phase 4 fixtures** | Slots + authored `timelineClips` | Parallel fixture array | Still pack → session |

Live-collab correctly treats Session lanes and Arrangement blocks as projections of the same slot/material ids. Public-demo mode still risks dual timeline stores. Domain `Arrangement.scenes` remains the playback spine; UI avoids Scene product language (interaction-invariants / owner-approved architecture).

### A.3 Material / revision path (shell signature path)

```text
Edit draft (piano/step)
  → SAVE_TO_LIBRARY (DeskLibraryClip, private)
  → SHARE_CLIP (Exchange Available)
  → FORK_CLIP / CLAIM_CLIP / SUBMIT_REVIEW / REVISE_CLIP
  → MARK_READY ("Accept for Shared Song" in UI)
  → STAGE_CLIP → LAUNCH_SLOT (queued) → COMMIT_LANE_LAUNCH (playing)
  → PROMOTE_CLIP (Ready fork → stage with lineage)
```

| Concern | Mechanism | Evidence |
|---------|-----------|----------|
| Private audition | `deskAuditionDraftId` + `PREVIEW_WORKSPACE` → `startPrivateCue` | `shellStore`, `shellAudioAdapter`, `wp6PrivateForkBoundary.test.ts` |
| Shared Master | `activeMasterDraftId` / lane playing; clears desk audition on activate | `ACTIVATE_SLOT` / `COMMIT_LANE_LAUNCH` |
| Fingerprints | Content hash on compile; scene pins store fingerprint | `sessionMaterialBank.ts`; edit bumps revision+fp (`shellMusicalIntegration.test.ts`) |
| Offer naming | Shell verb is **Share**, not Offer; domain `offerDraft` exists on `ProductionAction` but is **not** shell-wired | `sessionTypes.ts` vs `SHARE_CLIP` |
| Accept naming | UI: “Accept for Shared Song”; command: `MARK_READY` | `ExchangeRow.tsx` |

### A.4 Canonical / Live

| Path | Behavior | Mutates Canonical? |
|------|----------|--------------------|
| `DemoRuntime.freezeCanonicalSnapshot` → live clone + structural plan | Live session is a fork; `repinDraftReferences` leaves freeze intact | **No** (`r3LiveAuthority.test.ts`) |
| `buildCanonicalVsLiveComparison` | Scene/draft/fp/FX/structural deltas | Read-only compare |
| Shell Phase 5 | Progressive lane build + fork replace + promote; **not** the DemoRuntime Live act | N/A — different story |

Shell “Live Fork” in walkthrough ≈ Exchange `FORK_CLIP` + audible lane replace, **not** a full Performance Take object with Recall Board.

### A.5 Participant / role / workspace / capability

| Concept | Domain | Shell |
|---------|--------|-------|
| Person | `Participant` + `roleId` + `workspaceIds` | `Participant` + `taskProfile` + color + projection |
| Workspace | `Workspace` track scope | `ParticipantWorkspace` draft/tab/`libraryClips` |
| Capability | `PerformanceCapability` + `CapabilityAssignment` | Choreography maps launch operators; dock not capability-scoped |
| Cursor | — | Choreography overlay; **not** authority |

Distinctions exist in code; cold-viewer still primarily sees desks + cursors (Grok workspace critique). Capability model is stronger in domain/live ops than in shell IA.

### A.6 Cursors / choreography

- Phase 5: `runCommandChoreography` **then** `dispatch` (`presenterWalkthrough.ts`) — intent → gesture → domain.
- Navigation / projection: dispatch first, no fake cursor.
- Prefer one active + parked presence (Phase 5 design); off-room cursors dimmed on rail.
- Captions via `handoffCaptions.ts` (private desk → library → exchange → lane launch → recall → promote).
- **Risk residual:** dock/automation gestures can still look “human-operated” even when mode is fixture; `DockSlot.badge` never assigned (always `null`).
- `runPhase5WalkthroughRange` skips choreography (test/dev path).

### A.7 Collaboration-visible states

| On musical-adjacent UI | Shell/inspector / caption only |
|------------------------|--------------------------------|
| Exchange lifecycle chips: Available / In Progress / Review / Ready | `activityFeed`, `projectionCaption` |
| Lane states: empty → staged → queued → playing | `sessionPhase` building/performing |
| Compare panel: parent/fork `rN` + Listen | Domain `DraftStatus` (`offered` etc.) **not synced** to Exchange |
| Recall role chip on participant header | `recallRole` — **no** scene re-pin / Take object |
| Revision number on Exchange row | Fingerprint **not** shown on Exchange |

### A.8 Effect / automation origins

| Origin class (research) | Demo treatment |
|-------------------------|----------------|
| Scene preset | Scene `fx: MixParams` internal; no cursor required |
| Arrangement automation | Pack `mixAutomation` / offline path; not clearly labeled in shell UI |
| Live operation | Dock `SET_DOCK_VALUE` + cursor in walkthrough; mode CSS (`preview`/`capture`/`master`) |
| Gap | `DockBadge` PREVIEW\|CAPTURE\|MASTER unused; no origin tag on events for Recall |

### A.9 Voice placeholders

- **No** Voice Idea / voice-to-MIDI / capture stubs.
- `voicePlayback.ts` = synth scheduling; `DrumHit.voice` = kit voice name.
- Correct for research §16: do not claim realtime transcription.

---

## B. Research comparison (selected observations)

### B1. Create → library → share is now legible

- **Observed:** Phase 5 beats insert `SAVE_TO_LIBRARY` before `SHARE_CLIP`; captions `Private desk · shaping` → `Saved to library` → `Shared to Exchange`; Create UI exposes Save/Share + library list (`cfc8cd5`, fable-design-gap-audit).
- **Relevant DAW pattern:** Nondestructive personal take → publish to shared pool (Ableton: Clip in Session before Arrangement commit; collab tools: draft → PR).
- **Design inference:** Private → public boundary is the first EchLub differentiator viewers can grasp without jargon.
- **EchLub consequence:** Signature loop step “Offer” is partially communicated as Share; keep private library as the Working revision surface.
- **Demo limitation:** Desks still seed pack units (not empty “new clip”); Share ≠ Offer-with-musical-context proposal object.

### B2. Session grid and Arrangement as projections (live-collab)

- **Observed:** `projectLiveCollabTimelineClips` derives score-map from slots; comment forbids separate timeline store; launches rebuild domain arrangement from active lanes.
- **Relevant DAW pattern:** Ableton Session vs Arrangement as temporal organizations of the same Clip content; Ardour region/placement vs source.
- **Design inference:** Correct research alignment — materials first, views second.
- **EchLub consequence:** Preserve projection discipline; do not reintroduce dual clip tables for live-collab.
- **Demo limitation:** Public-demo fixtures still author `timelineClips` separately; Scene remains adapter-only (good for UI, but “Shared Song spine” is lanes, not named sections).

### B3. Private cue vs Shared Master

- **Observed:** Distinct shell flags + audio authorities; tests assert preview does not set `activeMasterDraftId`; cold-viewer chrome: Private desk badge, Desk preview hint, zone chips.
- **Relevant DAW pattern:** Local preview / cue vs master out; Ableton Preview vs Session Launch.
- **Design inference:** Realtime visibility of private work ≠ mutating Shared baseline.
- **EchLub consequence:** Strongest implemented instance of §6 Shared Song baseline.
- **Demo limitation:** Parallel private work across four desks is sequentialized by walkthrough Follow camera — reads as turn-taking more than parallel Freeform.

### B4. Exchange compare / Accept / Promote

- **Observed:** ComparePanel Listen Parent/Fork via `PREVIEW_WORKSPACE`; “Accept for Shared Song”; promote beat auditions parent then fork (`wp6PrivateForkBoundary.test.ts`).
- **Relevant DAW pattern:** Suggestion/review (Google Docs-like) + take selection; not Ableton-native.
- **Design inference:** Negotiation is the product differentiator vs multiplayer-Ableton.
- **EchLub consequence:** Protect compare-before-accept/promote choreography; surface decision on the clip, not only captions.
- **Demo limitation:** Compare is ID/revision + audition, not piano-roll Proposal Lens; Accept command is still `MARK_READY`; no Reject / Keep Alternate / Request Revision as first-class UI (Revise exists).

### B5. Canonical immutability vs shell “Live”

- **Observed:** DemoRuntime freezes Canonical; Live mutates clone; comparison fingerprints content. Shell Phase 5 has no Canonical snapshot object or Recall Board of structural Live ops.
- **Relevant DAW pattern:** Arrangement as committed form; Live Set / capture as take (Ableton Arrangement Record analogy is weak; closer to “performance take → consolidate”).
- **Design inference:** Two truthful stories exist; conflating them in presentation creates Ableton-remix reading.
- **EchLub consequence:** Presenter captions should not imply DemoRuntime Live Recall when showing Exchange fork promote.
- **Demo limitation:** No Performance Take entity; `recallRole` is caption/chip only.

### B6. Cursor precedes domain (Phase 5)

- **Observed:** Choreography runner completes gesture before `dispatch`; tests enforce projection-before-action ordering.
- **Relevant DAW pattern:** Control surface shows operator intent; automation lanes move without fake “user” cursors.
- **Design inference:** Cursor = attention/gesture; authority = state (lifecycle, lane, capability).
- **EchLub consequence:** Keep GSAP non-authoritative; never let cursor replace MaterialRef causality.
- **Demo limitation:** Continuous multi-cursor risk if all four always animate; dock sweeps may over-claim human live-ops vs scene-preset/automation.

### B7. Capability model vs Brain choreography

- **Observed:** `resolveCapabilityOperationContext` and pack performance views exist; shell walkthrough still desk/lane oriented; legacy BrainId mapped through capabilities.
- **Relevant DAW pattern:** Tracktion-style product workflow over replaceable engine; not user-facing “ownership”.
- **Design inference:** Capability Handoff (§9) is the distinctive Live interaction; desks are a demo cast preset.
- **EchLub consequence:** Do not freeze Four-Brain as product identity; keep assignment as data.
- **Demo limitation:** No NOW/NEXT Handoff Rail; authority transfer is Follow camera + sequential beats.

### B8. MaterialRef fingerprint truthfulness

- **Observed:** Bank resolve fails on fingerprint mismatch; launches assert fingerprints in `liveCollabLaneLaunch.test.ts`; Exchange shows `rN` only.
- **Relevant DAW pattern:** Content-addressed / immutable revisions (DAWproject export boundaries; Git-like intent without exposing Git).
- **Design inference:** Exact Shared Song advancement requires visible exactness when deciding.
- **EchLub consequence:** Cold-viewer needs revision identity on the object under decision (clip/lane), not only in tests.
- **Demo limitation:** Fingerprint hidden from Exchange/Compare UI → decision can look ID-based.

---

## C. Product differentiation assessment

### C.1 Distinctive moments already present (when narrated correctly)

1. **Private desk → library → Exchange** — Working vs Shared entry.
2. **Desk preview / private cue while Shared Master stays** — parallel state without mutating baseline.
3. **Fork → compare audition → Accept / Promote** — negotiation with audible consequence.
4. **Progressive lane Launch into Shared Master** — Shared Song advances by exact materials, DJ-legible.
5. **Follow Active + one primary cursor** — attention without equating cursor to authority (when captions stay honest).

### C.2 What still reads as multiplayer-Ableton

- Session grid + Arrangement score map + mixer + piano roll + Scene-like launches (even without Scene label).
- Multiple colored cursors as the primary “collaboration” signal.
- Dock knobs / capture mode without origin tagging.
- Cast desks as fixed roles rather than temporary scoped authority.
- Payoff that sounds like “everyone jammed on a Session” if create→offer→accept is rushed.

### C.3 Non-competitive claims (do not lean on)

- Web DAW feature parity; Voice-to-MIDI / AI arrangement as primary differentiator; CRDT multiplayer; plugin host; “Ableton in the browser”.

### C.4 Signature interaction candidates (ranked for demo clarity)

| Candidate | Why distinctive | Demo readiness |
|-----------|-----------------|----------------|
| **Offer + Accept exact revision** | Advances Shared Song atomically | Partial (Share / MARK_READY) |
| **Private Cue beside Shared spine** | Parallel creative state | Strong |
| **Compare before Promote** | Decision, not click chain | Partial (audition pair) |
| **Musical Handoff Rail (NOW/NEXT @ bar)** | Audible authority transfer | Weak / caption-only |
| **Live Recall Cards → Promote** | Post-performance musical decisions | Weak (`recallRole` only) |
| **Revision Stack on clip** | Shared / private / offered / live | Weak (chips only) |

Working differentiation hypothesis (from context) remains valid: **branchable collaborative workspace → exact shared song → perform → retain Live moments** — not multiplayer Session view.

---

## D. Candidate improvements

Classification key: presentation-only | choreography-only | bounded Demo behavior | product-domain candidate | engine/architecture candidate | not recommended

Authorization: **currently authorized** only if covered by active Phase 5/6 / create-library-share / private-boundary style packages; else **research-only / needs owner gate**.

| # | Candidate | Class | Value | Regression risk | Authority boundary | Likely files | Authorized? |
|---|-----------|-------|-------|-----------------|-------------------|--------------|--------------|
| D1 | Show `rN` + short fingerprint stem on Exchange row / Compare | presentation-only | Exact revision legibility (§25.7) | Low | Labels only; no identity change | `ExchangeRow.tsx`, `SharedClipExchange.tsx` | **Needs tiny package** (not auto) |
| D2 | Rename caption/UI “Share”→“Offer” only where lifecycle is proposal | presentation-only | Signature vocabulary | Low–med (copy drift) | Naming; keep `SHARE_CLIP` command | `handoffCaptions.ts`, Create editor, Exchange | Research-preferred; gate copy |
| D3 | Persist `DockBadge` from `dockMode` / pin origin | presentation-only | scene-preset vs live-op clarity | Low | UI badge; no audio rewrite | `LiveControlDock.tsx`, `shellStore` PIN/SET_DOCK_MODE | Needs small package |
| D4 | Handoff caption strip: NOW participant·lane / NEXT @ bar | choreography-only + presentation | Musical Handoff without locks | Low | Presenter chrome only | `PresenterCaptionStrip.tsx`, `handoffCaptions.ts`, walkthrough labels | Phase 5 chrome-adjacent; **gate** |
| D5 | Enforce compare dwell before Accept/Promote in manual UI (disable until both listened) | bounded Demo behavior | Negotiation over click chain | Med | Shell UX policy, not CRDT | `SharedClipExchange.tsx`, tests | Needs authorization |
| D6 | Bridge Exchange lifecycle ↔ domain `DraftStatus` | product-domain candidate | One collaboration vocabulary | Med–high | Domain sync; avoid dual truth | `shellStore`, musicalDomain, types | **Not authorized** |
| D7 | Performance Take + Recall Board from Live structural ops | product-domain candidate | §14 signature close | High | New objects; DemoRuntime↔shell merge risk | `demo/*`, shell, features | **Not authorized** |
| D8 | Real Capability Handoff at bar boundary | product-domain + engine | Distinctive Live | High | CapabilityAssignment mutation + transport | `capabilityOperations`, audioEngine boundaries | **Not authorized** |
| D9 | Unify DemoRuntime Canonical/Live with shell Phase 5 story | engine/architecture | One act model | Very high | Architecture rewrite | demo + shell + audio | **Not authorized / not recommended now** |
| D10 | Voice Idea precomputed stub in pack | bounded Demo behavior | §16 intent path | Med (false capability claims) | Pack + Create entry only | pack JSON, CreateEditor | **Not authorized**; claim honesty required |
| D11 | Reader/writer locks / CRDT / all collab modes | not recommended (now) | — | — | Explicitly out of §27 | — | **Forbidden** |
| D12 | MaterialRef redesign / AudioEngine-as-domain | not recommended | — | — | Violates truthfulness path | — | **Forbidden** |
| D13 | Proposal Lens (piano-roll diff overlay) | product-domain + presentation | Real compare decision | Med | Visual diff; same materials | CreateEditor, exchangeCompare | Research; needs package |
| D14 | Keep Alternate / Reject on Exchange | bounded Demo behavior | Negotiation completeness | Low–med | Shell commands + chips | shellTypes, ExchangeRow | Needs authorization |
| D15 | Re-capture Phase 5 A/V after library beats | choreography-only / evidence | Proof of loop | Low | Artifacts only | `scripts/capture-phase5-demo.mjs` | **Already expected** (fable audit) |

**Largest clarity / smallest risk (research pick):** D1 (revision identity on decision objects) and D4 (NOW/NEXT handoff chrome), then D3 (dock origin badge). None implemented in this research pass.

---

## E. Transferable conclusions

### E.1 echlub-demo findings (evidence-backed)

1. Live-collab Session↔Arrangement projection discipline is sound and should be protected.
2. Private library + private cue + Shared Master separation is the strongest implemented signature-loop fragment.
3. Fingerprinted MaterialRef path remains the musical authority; Exchange lifecycle is a parallel collaboration projection not yet bridged to `DraftStatus`.
4. Phase 5 cursors correctly precede dispatch; they must not become the story of automation or Shared mutation.
5. Canonical/Live immutability is proven in DemoRuntime tests but is **not** the Phase 5 presenter narrative — do not imply Recall Board completeness.
6. Voice is absent; synth “voice” naming must not be sold as Voice Idea.
7. Cold-viewer work (desk inset, library beats, captions) reduced “one shared canvas” risk but negotiation still under-signaled vs Session launching.

### E.2 Future echlub product hypotheses (not demo requirements)

1. Collaboration Mode as policy (Freeform / Review / Turn-based / Guided Jam / Live) selecting how Shared advances — not a toolbar of all modes at once.
2. Musical Handoff as first-class scoped authority transfer at phrase/bar boundaries.
3. Performance Take + Recall Cards as post-Live decision objects.
4. Voice Idea as intent ingress into the same Material revision pipeline (progressive disclosure), not as AI song completion.
5. Rust-metaphor creative authority without exposing ownership jargon or blocking locks.
6. Interchange (DAWproject/WAM) as boundary adapters; EchLub-native semantics stay MaterialRef + proposal/accept + Live Recall.

### E.3 General DAW research observations

1. Session and Arrangement as dual stores of unrelated content is a common product footgun; projections over shared materials scale better to collaboration.
2. Black-box Ableton is valuable for flow (explore → perform → arrange); white-box OSS (Ardour/Zrythm/Tracktion) is valuable for nondestructive placement, graph, and engine/editor split — neither dictates EchLub product identity.
3. Cursor multiplicity communicates presence; without explicit Shared/private/Live state on musical objects, products collapse to “multiplayer DAW”.
4. Exact revision identity (content fingerprint) is what makes Accept/Promote musically meaningful versus filename sync.
5. Automation origin tagging (preset vs scheduled vs live gesture) is required before performance capture can become Recall.

---

## §25 Research questions (brief)

| # | Answer (evidence level) |
|---|-------------------------|
| 1 | Signature loop fragments: create→library→share, private cue, fork/compare/accept, lane launch, promote audition. Full Live Recall → Promote Take: **weak**. |
| 2 | Session grid, piano roll, mixer, dock, multi-cursors without negotiation emphasis → conventional DAW + multiplayer. |
| 3 | Domain `DraftStatus`, fingerprints, capability assignments, Canonical snapshot — mostly inspector/tests; Exchange chips + captions carry UI state. |
| 4 | Phase 5: yes for scripted ops (choreography before dispatch). Not for navigation-only; range runner skips cursors. |
| 5 | Risk: dock capture/sweep and scene fx can look human-driven; badges unused. No strong evidence of cursors on pure arrangement-automation lanes in Phase 5 script. |
| 6 | Improved post-desk/library pass; still easy to miss Shared vs Live fork vs Canonical. |
| 7 | Revision `rN` on Exchange/Compare; fingerprint not viewer-visible; bank enforces exactness under the hood. |
| 8 | Lane queued→playing + afterBar launches communicate activation; Accept vs Launch still two moments (good if captioned). |
| 9 | Partial negotiation (compare listen, revise); walkthrough still largely sequential script — risk of “button ballet”. |
| 10 | DemoRuntime Live: yes (structural + content fp diffs). Shell Phase 5: audible fork replace + promote — meaningful but not full Live act. |
| 11 | Compare supports audition decision; not structural/piano-roll diff decision. |
| 12 | MaterialRef bank, private vs shared baseline, Session/Arrangement projection, capability≠participant, Canonical≠Live, compare-before-promote. |
| 13 | Four named cast desks, GSAP cursor film, precomputed pack units, presenter Follow camera as “collaboration”. |
| 14 | Dual command buses (shell vs DemoRuntime); Exchange lifecycle ≠ DraftStatus; AudioEngine private pattern tables; timeline dual-store in public mode; cursor-as-causality. |
| 15 | Surface exact revision on decision UI + honest NOW/NEXT handoff chrome (D1/D4); avoid architecture merge. |

---

## Authority checklist (this pass)

| Item | Status |
|------|--------|
| Research context file written | Yes — `collaborative-daw-research-context.md` |
| Research vs demo note written | Yes — this file |
| Code changes | **None** |
| Commits / push / merge | **None** |
| Optional tiny presentation fixes | Deferred (prefer note; D1/D3/D4 need explicit micro-package) |

---

## Related prior notes

- `product-state-model.md`, `interaction-invariants.md`, `owner-approved-architecture.md`
- `phase5-collab-performance-demo-proposal.md`, `phase6-demo-runbook.md`, `fable-design-gap-audit.md`
- `grok-workspace-create-clarity-critique.md`, `implementation-boundary.md`
