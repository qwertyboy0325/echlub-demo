# Problem Definition — EchLub Visual Language

**Gate:** Owner Visual Direction (pre–Phase 3B)  
**Locked IA:** `design-research/owner-approved-architecture.md`  
**Frozen eval candidate:** 5ece39e React shell (no further `src/**` work)

## What must be decided

EchLub V2 has an approved information architecture (Three Rooms, Focus Shell, Exchange lifecycle, Follow lock, Stage/Activate). Phase 3A produced a functional fixture shell whose **visual appearance reads as generic AI SaaS dashboard** — not a credible collaborative music studio.

Before any further canonical implementation, the owner requires a **coherent visual language** with three distinct, high-fidelity directions on the **same IA**.

## Visual failure of current shell (5ece39e baseline)

Observed patterns (inferred from prior skeleton frames + rejected dashboard evidence; `artifacts/shell-ready/` not present in repo):

| Symptom | Product damage |
|---------|----------------|
| Cool blue accent on everything | Reads as dev-tool / admin UI, not studio |
| Rounded cards with soft gradients on meters | Decorative, not operational |
| Uniform pill density in nav + exchange | Competing for attention with musical content |
| Low typographic hierarchy | Clip metadata, lifecycle, and transport compete equally |
| Miniature-dashboard residue in color logic | Collaboration state invisible at a glance |

## Success criteria for visual direction gate

| Criterion | Measure |
|-----------|---------|
| Three distinct systems | A/B/C frames share IA, differ in tokens + control anatomy |
| Anti-AI compliance | No kill-list patterns in any direction |
| Recording legibility | 1280×720 frames readable without zoom |
| Collaboration grammar | Participant / track / workflow / selection colors separable |
| Musical focus | ≥60% center dominance preserved; Exchange secondary |
| Owner decision packet | Sol recommendation + Grok cold critique + explicit decisions |

## Non-goals

- React implementation or token wiring in `src/**`
- New library installs (Dockview, interactjs, etc.)
- Visual copy of Ableton, Bitwig, Figma, Linear, or shadcn dashboards
- Phase 4 choreography or audio wiring

## Owner hypothesis to test

**A global chrome + B tactile accents** for Devices / Mixer / Live Control Dock — evaluated honestly in `strong-model-synthesis.md` and `grok-independent-critique.md`.
