# EchLub Demo — Consolidated Collaborative DAW Research Context

> **定位（中文）**  
> 這版定位：把 echlub-demo 當成實際的 DAW 研究原型來檢驗產品假說。研究結論、建議與已授權實作必須分開；不得把研究背景直接解讀成全面改造工作包。

This context applies directly to `echlub-demo`.

`echlub-demo` is currently a bounded concept demonstration, but it is also a
research prototype for:

- collaborative DAW interaction;
- revisioned musical materials;
- shared versus private creative state;
- arrangement and performance authority;
- multi-participant cursor semantics;
- musical handoff;
- Canonical versus Live divergence;
- post-performance recall;
- accessible musical-intent input.

Use this document as a product and DAW research lens while inspecting or
working on the current repository.

It may inform analysis, naming, choreography, interaction presentation and
bounded implementation choices inside an already authorized work package.

It does not independently authorize an architecture rewrite or unrelated scope
expansion.

Repository facts, current HEAD, existing rules, accepted runtime invariants,
actual tests and current musical behavior remain the engineering authority.

---

# 1. Research framing

The research should distinguish two kinds of DAW evidence.

## Black-box product and workflow evidence

Commercial DAWs such as Ableton Live are useful for studying:

- user-visible behavior;
- temporal workflow;
- Session versus Arrangement interaction;
- playback arbitration;
- contextual editing;
- nondestructive variation;
- live performance capture;
- parameter and control-surface design.

Their internal implementation should not be invented from UI behavior.

Record:

1. documented or observed behavior;
2. structural evidence exposed through public object models or APIs;
3. design inference;
4. possible consequence for EchLub.

## White-box architectural evidence

Open-source DAWs and embeddable engines are useful for studying:

- source, region and placement separation;
- nondestructive editing;
- routing and processor graphs;
- automation ownership;
- timeline and clip representation;
- engine/editor separation;
- plugin and interchange boundaries;
- persistence structures;
- scheduling and transport authority.

Do not assume that an open-source DAW's internal model is automatically a good
product model for EchLub.

The useful research question is:

> Which mechanisms support the collaborative workflow EchLub is trying to
> communicate?

---

# 2. Competitive diagnosis

A conventional presentation of `echlub-demo` may currently be interpreted as:

> an Ableton-inspired Session and Arrangement interface with multiple cursors,
> roles and Live controls.

That description is not sufficiently distinctive.

The following elements are useful but do not independently establish product
identity:

- Session Grid;
- Arrangement Timeline;
- piano roll;
- mixer;
- effects;
- multiple participant cursors;
- role assignment;
- Scene launching;
- turn-based collaboration;
- voice-to-MIDI;
- AI-assisted arrangement.

The working differentiation hypothesis is not:

> a web DAW with multiplayer.

It is:

> a branchable collaborative music workspace in which creators work in
> parallel, agree on an exact shared song, perform from that song, and retain
> selected Live moments.

---

# 3. Signature product loop

The primary candidate workflow is:

```text
Create Variation
→ Private Audition
→ Offer in Musical Context
→ Review / Compare
→ Request Revision or Accept
→ Advance the Shared Song
→ Perform from the Shared Song
→ Create a Live Fork
→ Recall selected Live moments
→ Promote chosen changes
```

The important product objects are not merely files or edits.

They include:

* a stable Shared revision;
* a private Working revision;
* an Offered Proposal;
* an accepted exact Material revision;
* a Scene that pins exact MaterialRefs;
* a Canonical arrangement snapshot;
* a temporary Live fork;
* a Performance Take;
* a recalled musical moment;
* a promoted post-performance revision.

When evaluating a UI or choreography choice, ask whether it makes this loop
clearer.

---

# 4. Session and Arrangement research

A major DAW research conclusion is that Session and Arrangement should not be
treated as separate stores of unrelated musical content.

The preferred interpretation is:

```text
Materials and revisions
        ↓
Session projection
Arrangement projection
Performance projection
```

Session and Arrangement are different temporal organizations of shared musical
materials.

Useful consequences:

* the same Material revision may appear in Session and Arrangement;
* Scene placement should refer to exact content rather than copy hidden data;
* Arrangement should organize placement and temporal structure;
* Session should organize alternatives, launching and preparation;
* Live performance may temporarily override or reinterpret Arrangement;
* accepted performance results may later become Arrangement changes.

Do not duplicate musical truth across:

* Session Clip tables;
* Arrangement Clip tables;
* AudioEngine private pattern tables;
* choreography fixtures;
* comparison-only snapshots.

---

# 5. Source, Material, reference and placement

Keep these concepts distinct.

## Source

The originating content:

* audio recording;
* MIDI capture;
* voice idea;
* imported file;
* generated phrase;
* manually entered notes.

## Material

A normalized, playable and revisioned musical unit.

Examples:

* drum pattern;
* bass phrase;
* harmony voicing;
* melody phrase;
* texture design;
* automation gesture.

## Material revision

An immutable identifiable version of Material content.

Useful identity:

```text
draftId
revision
fingerprint
```

## MaterialRef

A reference to one exact revision.

## Clip or Session Cell

A playable or editable projection of Material within a workspace.

## Placement

The use of an exact MaterialRef at a specific Scene, Track, section or time
range.

Changing placement must not silently change the underlying Material.

Changing a Material revision must not silently rewrite all placements unless
the product action explicitly performs that promotion.

---

# 6. Shared Song as a stable baseline

The agreed song should remain distinguishable from work in progress.

A preferred flow is:

```text
Shared Bass r4
→ participant creates Working Bass r5
→ Private Cue
→ Offer
→ Review
→ Accept
→ Shared Bass atomically advances to r5
```

Avoid treating every pointer drag as an immediate mutation of the agreed
Shared Song unless the selected collaboration policy explicitly allows this.

Other participants may still observe the in-progress revision in realtime.

Realtime visibility does not require realtime mutation of the accepted
baseline.

---

# 7. Rust-inspired creative authority

Rust ownership and borrowing are a design metaphor, not a user-facing
programming model.

Do not expose terminology such as:

* ownership;
* borrow checker;
* mutable borrow;
* lifetime;
* move semantics;
* `&mut`;
* `Arc`;
* `Rc`.

The useful design principles are:

* one explicit source of musical truth;
* immutable snapshots;
* many observers;
* bounded mutation authority;
* explicit transfer;
* predictable release;
* no hidden mutation;
* conflicts converted into safe alternatives.

## Product interpretation

```text
Workspace owns the Shared Song.

Participants may own private Drafts and Variations.

Participants receive temporary authority to edit, review or perform on a
bounded musical scope.

Accepted Materials become Shared Song state.
```

Possible user-facing states:

* Viewing;
* Listening;
* Editing;
* Preparing;
* Reviewing;
* Ready;
* Queued;
* In control;
* Pass control;
* Released.

## Important usability rule

Do not implement literal reader/writer locking that blocks normal creative
work.

This state is valid:

```text
three participants listen to Shared r4
while one participant creates Working r5
```

This state is ambiguous:

```text
two participants both claim to mutate Shared r4 in place
```

Prefer:

1. create parallel Variations;
2. separate the musical scope;
3. request a Handoff;
4. explicitly enter a bounded co-edit flow;
5. follow the active editor.

Conflict should usually create a creative path, not only an error message.

---

# 8. Musical scope

Creative authority should conceptually be scoped.

Possible scopes include:

* Clip;
* phrase;
* bar range;
* Scene;
* Track;
* Track family;
* automation lane;
* one effect parameter;
* performance capability;
* structural operation.

Avoid designing note-level permission prompts.

The default product scope should be musically meaningful and understandable.

Examples:

```text
Editing Bass · Bridge
Controlling Melody · until next phrase
Reviewing Trade Scene variation
Preparing Low End for Return
```

---

# 9. Musical Handoff

A distinctive EchLub interaction candidate is musical Handoff.

A Handoff is not merely changing a database permission.

It is the visible and audible transfer of temporary creative or performance
responsibility.

A credible Handoff contains:

```text
current participant
current material or capability
next participant
prepared material or operation
activation boundary
release of previous authority
activation of new authority
audible or structural consequence
```

Example:

```text
Ezra controls Tenor
→ Amy privately auditions an Alto response
→ Amy becomes Ready
→ Handoff is queued for the next phrase
→ Tenor completes the phrase
→ Ezra releases Melody control
→ Amy becomes active
→ Alto response begins
```

Possible presentation:

```text
NOW
Ezra · Tenor

NEXT @ bar 28
Amy · Alto
```

The musical boundary may be:

* next beat;
* next bar;
* next phrase;
* next Scene;
* host-confirmed transition;
* end of the current performance operation.

---

# 10. Cursor research

Visible participant cursors remain important.

Do not remove multi-participant cursors merely because authority is modeled
separately.

The correct distinction is:

```text
Cursor
= attention, intent and physical gesture

Authority
= explicit musical or workflow state
```

A cursor alone must not be the only proof that a participant controls
something.

## Cursor presentation states

Useful cursor states include:

* Viewing;
* Following;
* Listening;
* Editing;
* Reviewing;
* Preparing;
* Ready;
* Controlling;
* Releasing.

## Cursor layers

### Presence

Shows where a participant is looking.

It does not imply edit authority.

### Intent

Shows that a participant is:

* auditioning;
* reviewing;
* preparing;
* requesting Handoff;
* queued for a future boundary.

### Active operation

Shows a real participant-operated action.

It may include:

* stronger cursor treatment;
* musical-scope highlight;
* operation label;
* active revision;
* active capability.

## Choreography constraints

Avoid:

* every cursor moving continuously;
* long robotic flights across the complete DAW;
* using cursor motion as substitute for domain state;
* placing a cursor over deterministic automation and falsely implying a human
  performed it;
* cursor animation that occurs after the underlying operation has already
  completed.

Prefer:

```text
one primary active cursor
plus at most one prepared or reviewing cursor
```

Other participants may remain visible through lightweight presence indicators.

A real gesture should follow:

```text
participant intent becomes visible
→ cursor performs the gesture
→ domain operation begins
→ audible, structural or revision consequence occurs
→ operation completes
→ resulting state remains visible
```

---

# 11. Collaboration modes

Collaboration Mode is a product policy, not merely a toolbar selector.

It should determine how changes enter Shared state.

## Freeform

* participants may obtain bounded editing scope quickly;
* non-overlapping work can proceed in parallel;
* overlapping work preferably creates Variations;
* promotion may be permissive.

## Review / Suggestion

* Shared Song remains stable;
* participants create Proposals;
* reviewers Accept, reject or Request Revision.

## Turn-based

* authority moves by turn or round;
* the next participant may prepare privately;
* active authority releases when the turn ends.

## Guided Jam

* a host provides section, role, prompt or capability constraints;
* participants contribute inside those musical constraints.

## Live Performance

* Canonical remains immutable;
* operations affect a Live fork;
* capability authority may transfer at musical boundaries;
* selected changes may be recalled afterward.

Do not implement all modes merely because they are listed.

Use the model to evaluate consistency of current interactions.

---

# 12. Collaboration operations

Useful domain-level operations include:

* Preview;
* Private Cue;
* Create Variation;
* Offer;
* Request Revision;
* Accept;
* Reject;
* Keep Alternate;
* Pin Revision;
* Queue;
* Launch;
* Hold;
* Replace;
* Release;
* Handoff;
* Recall;
* Capture;
* Promote.

These should not all become permanent buttons.

The visible operation set should depend on:

* selected musical object;
* current collaboration mode;
* current authority;
* current act;
* current decision.

---

# 13. Canonical, Live and Performance Take

Canonical and Live must remain distinct.

## Canonical

The exact agreed song snapshot.

It should contain exact:

* Scene order;
* MaterialRefs;
* revisions;
* fingerprints;
* placements;
* mix state;
* relevant automation;
* structure.

## Live

A fork created from Canonical.

Live changes may include:

* revised Material;
* alternate Scene;
* hold;
* replace;
* extension;
* alternate transition;
* alternate ending;
* effect gesture;
* temporary mix change;
* capability Handoff.

Live must not silently mutate Canonical.

## Performance Take

The resulting Live sequence should be treated as a meaningful object, not only
an operation log.

It may contain:

* musical changes;
* structural changes;
* participant provenance;
* capability provenance;
* timing;
* exact revisions;
* effect gestures;
* retained performance moments.

---

# 14. Live Recall

Performance should not end with only an audio recording or debug log.

A candidate EchLub workflow is:

```text
perform from Canonical
→ create Live differences
→ finish the Take
→ inspect meaningful moments
→ audition Canonical versus Live
→ promote selected moments
```

A Recall Board may show:

```text
Bridge extended by 4 bars
Harmony r1 changed to r2
Alto replaced Tenor at bar 28
Delay throw occurred at phrase ending
Drums were removed from Outro
Alternate ending used
```

Possible actions:

* Promote to Shared Song;
* Keep as Alternate Take;
* Extract as reusable Scene;
* Preserve only the Material revision;
* Discard.

Raw runtime events should be converted into musical decisions.

---

# 15. Automation and participant action

Keep effect and automation origins distinct.

At minimum distinguish:

```text
scene-preset
arrangement-automation
live-operation
```

## Scene preset

A predefined state applied because a Scene becomes active.

No participant cursor is required unless a participant explicitly launches or
changes it.

## Arrangement automation

A deterministic scheduled change authored before playback.

Do not render a participant cursor performing it live.

## Live operation

A participant-controlled gesture occurring during the performance.

This may legitimately render:

* participant cursor;
* active capability;
* parameter movement;
* audible consequence;
* operation completion.

The UI and evidence should not confuse these sources.

---

# 16. Voice-to-instrument research

Voice-to-instrument conversion should no longer be treated as the independent
primary differentiator.

Voice-to-MIDI, automatic transcription and AI arrangement are increasingly
available elsewhere.

The more defensible EchLub role is:

> voice is a fast, expressive way to introduce human musical intent into a
> collaborative workflow.

Preferred conceptual flow:

```text
sing, hum or beatbox
→ create Voice Idea
→ retain rhythm, pitch contour, dynamics or articulation
→ project into one or more instrument interpretations
→ Private Cue
→ Offer to the relevant collaborator
→ collaborator refines instrument-specific details
→ Accept an exact Material revision
```

Examples:

* a singer hums a Bass idea for the Bass producer;
* a producer beatboxes a rhythm for a drummer;
* an arranger sings an Alto or Tenor response;
* a beginner captures an idea without first using a piano roll.

The value is not:

```text
AI completes the song
```

The value is:

```text
human expression
→ editable musical intent
→ instrument interpretation
→ collaborative refinement
→ accepted music
```

A precomputed Voice Idea is acceptable in a concept demonstration as long as
the presentation does not falsely claim a completed realtime transcription or
AI arrangement capability.

---

# 17. Beginner accessibility

Beginner experience should not weaken the underlying music model.

Use progressive disclosure.

A beginner may see:

```text
Sing an idea
Create Variation
Hear it privately
Offer to the group
```

An advanced user may inspect:

* piano roll;
* timing;
* articulation;
* velocity;
* automation;
* routing;
* exact revision;
* Material provenance.

The same underlying Material should support both views.

Do not create a separate simplified musical truth for beginner mode.

---

# 18. Ableton-related research lens

Use Ableton primarily as a black-box reference for:

* Session and Arrangement as different temporal organizations;
* Scene and Clip launching;
* local playback arbitration;
* performance becoming arranged material;
* contextual editor switching;
* nondestructive Clip-local expression;
* stable parameter surfaces;
* synchronized musical time.

Do not copy Ableton's interface as the EchLub identity.

The relevant question is:

> How does Ableton preserve creative flow between exploration, performance and
> arrangement, and how can EchLub extend that flow to multiple creators?

A possible distinction is:

```text
Ableton:
individual exploration
→ Session performance
→ Arrangement

EchLub:
parallel exploration
→ private audition
→ negotiation and acceptance
→ Shared Arrangement
→ collaborative performance
→ Live Recall
```

---

# 19. Open-source DAW research lens

Use open-source systems to evaluate mechanisms.

## Ardour-style questions

* Is source content separate from region and placement?
* Are edits nondestructive?
* Does routing remain separate from Track identity?
* Is automation owned by an explicit object?
* Can processing state be reproduced exactly?

## LMMS-style questions

* Can complexity be progressively disclosed?
* Are workspaces and specialized editors separated clearly?
* Can beginners enter without weakening musical structure?

## Zrythm-style questions

* Is the processing graph explicit?
* Are ports and connections represented independently?
* Does automation clearly target a parameter owner?

## Tracktion Engine-style questions

* Can the editor and audio engine be separated?
* Can a higher-level product own workflow while the engine remains replaceable?

## WAM-style questions

* Can web effects and instruments eventually be isolated behind an adapter?
* Can extension permissions and compatibility remain outside the core music
  domain?

## DAWproject-style questions

* Which parts of the project should be interoperable?
* Which native collaboration semantics must remain EchLub-specific?
* Is interchange a boundary rather than the native domain model?

Do not implement plugin or interchange systems in the current Demo unless an
explicit package requires them.

---

# 20. Domain distinctions

Do not collapse these concepts:

```text
Participant
Role
Workspace
Track
Source
Material
Material Revision
Clip
Scene
Arrangement
Capability
Assignment
Collaboration Mode
Performance View
Performance Take
Cursor
```

Examples:

* Participant is a person in the session.
* Role is a responsibility or social function.
* Workspace is the editing surface available to a participant.
* Track is a musical or routing container.
* Material is revisioned musical content.
* Clip is a projection or use of Material.
* Scene groups exact MaterialRefs for playback.
* Arrangement defines temporal structure.
* Capability defines what can be controlled during performance.
* Assignment connects a participant to a capability.
* Cursor represents attention or gesture.
* Cursor is not a role, capability or authority owner.

---

# 21. Runtime and domain boundary

The audio runtime should consume an explicit immutable read model.

Preferred general shape:

```text
Arrangement Workspace
→ immutable playback snapshot
→ Audio Runtime
```

The runtime should not invent musical truth.

The following remain distinct:

* Arrangement domain;
* Audio Runtime;
* Collaboration Space;
* Collaboration Mode;
* Realtime Coediting;
* extension and interchange boundaries.

AudioEngine should not become the product domain.

Transport, Tone.js, WebAudio, AudioWorklet, WebAssembly and plugin hosting are
runtime adapters unless their behavior becomes a real product invariant.

---

# 22. Current demo truthfulness

When inspecting `echlub-demo`, preserve the current accepted principle that:

```text
ReconstructionPack
→ ProductionSession
→ SessionMaterialBank
→ revisioned MaterialRef
→ AudioEngine
```

Production, Cue, Canonical, Live and Comparison should refer to the exact
musical revisions they claim to use.

Do not regress toward:

* hidden AudioEngine pattern tables;
* same-ID/different-content ambiguity;
* fallback music that is not represented in session state;
* UI-only edits;
* cursor-only causality;
* comparison based only on IDs;
* Live changes leaking into Canonical.

---

# 23. UI implications

Collaboration semantics should appear on musical objects where useful.

Possible states include:

* Shared;
* Private;
* Working;
* Offered;
* Under Review;
* Revision Requested;
* Accepted;
* Queued;
* Ready;
* Live Override;
* Recalled;
* Promoted.

Do not show all states simultaneously.

Prioritize the current decision.

Useful candidate components:

## Revision Stack

```text
Shared r4
Amy r5 · private
Ezra r5-alt · offered
Live r4-L2 · active
```

## Handoff Rail

```text
NOW          NEXT             LATER
Tenor        Alto             Drum break
Ezra         Amy              Ryan
```

## Proposal Lens

Overlay differences in:

* piano roll;
* Clip;
* Scene;
* Arrangement.

## Shared Song Spine

Keep the Shared baseline visible while showing:

* private Variation;
* Proposal;
* Live divergence;
* recalled moment.

## Recall Cards

Convert Live operations into auditionable musical decisions.

These are interaction hypotheses, not mandatory current components.

---

# 24. Concept-demo strategy

The concept demonstration does not need to implement a production-grade version
of every researched idea.

It may use bounded, precomputed or deterministic examples.

The important requirement is semantic truthfulness.

A useful focused example could be:

```text
Shared Tenor revision
→ Amy creates Alto Variation
→ Amy uses Private Cue
→ Amy offers the response
→ Arrangement Director reviews it
→ exact revision is accepted and pinned
→ Canonical plays it
→ Live extends the Tenor phrase
→ Recall keeps the Alto revision but preserves the Tenor extension only as an
  alternate Take
```

This single story could demonstrate:

* private work;
* parallel creative state;
* audition;
* Offer;
* review;
* exact revision acceptance;
* Shared Song advancement;
* Live fork;
* Handoff;
* Recall.

Do not force this scenario into the current implementation if doing so would
destabilize accepted work.

---

# 25. Research questions for the agent

While inspecting or modifying the current Demo, consider:

1. Which current interactions already communicate the signature loop?
2. Which interactions look like conventional DAW behavior without an EchLub
   distinction?
3. Which collaboration states exist only in an inspector but should appear on
   musical objects?
4. Does cursor choreography represent real participant intent and operations?
5. Are any cursors implying control over deterministic automation?
6. Is Shared versus private versus Live state visually clear?
7. Can a viewer identify the exact revision being auditioned or played?
8. Can a viewer understand when a change becomes active?
9. Does the Demo show negotiation, or only sequential button clicking?
10. Does the Live act create musically meaningful divergence?
11. Does Comparison support a real decision?
12. Which concepts are transferable to the separate `echlub` product?
13. Which concepts are only suitable for the concept film?
14. Which architectural choices would make later collaboration interaction
    difficult?
15. Which candidate improvement gives the largest product clarity with the
    smallest regression risk?

---

# 26. Requested research output

Produce a design-research note that covers:

1. Current implementation map.
2. Research comparison using Observed / Relevant DAW pattern / Design
   inference / EchLub consequence / Demo limitation.
3. Product differentiation assessment.
4. Candidate improvements classified by scope and authorization.
5. Transferable conclusions for `echlub-demo`, future `echlub`, and general
   DAW research.

See: `design-research/collaborative-daw-research-vs-demo.md`.

---

# 27. Implementation authority and safety

Research may guide:

* labels;
* choreography;
* state presentation;
* bounded demo behavior that clarifies the signature loop.

Research does not authorize:

* a full ownership system;
* reader/writer locking;
* networking and CRDT work;
* implementing every collaboration mode;
* implementing Voice AI;
* implementing a plugin host;
* redesigning AudioEngine as the product model;
* replacing MaterialRef identity;
* a full UI redesign outside an authorized package.

When an agent finds a conflict between research aspiration and current
accepted architecture, it must:

1. report the conflict;
2. preserve accepted runtime invariants;
3. propose the smallest clarifying change;
4. wait for owner authorization before expanding scope.

Agents must separate:

* research conclusions;
* recommended product directions;
* currently authorized implementation work.

No push.
No merge.
No silent expansion into architecture rewrite.
