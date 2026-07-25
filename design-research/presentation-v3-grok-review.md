# Presentation V3 — Grok Review

**Date:** 2026-07-25  
**Baseline compared:** `cfc8cd5` FocusShell (split lane table + score map, permanent Exchange rail on wide, PresenceRail, zone chip stacks, presenter chrome)  
**Evidence:** `artifacts/presentation-v3/*.png`, browser MCP walkthrough on `http://localhost:4173/?presentation=v3`

---

## Ranked blockers (max 5)

### 1. Participant Create still carries legacy FocusShell chrome (severity: high)
**Question:** Primary musical action dominant?  
**Finding:** v3 header is compact, but reused `CreateEditor` still renders duplicate PRIVATE DESK badges, library empty panel, and toolbar bands — editor grid occupies ~45% height, not 70–85%.  
**vs cfc8cd5:** Better than zone-chip stack + PresenceRail, but not yet “editor-first.”  
**Fix applied (Phase E):** Hide `create-context-header` and in-editor `desk-library-queue` inside v3 participant `.editor` via scoped CSS module `:global` descendants.

### 2. Exchange overlay competes with room nav when open (severity: medium)
**Question:** Cold viewer can follow manual sequence?  
**Finding:** Drawer backdrop blocked Mixer nav clicks during walkthrough step 8; Close did not always dismiss before next action.  
**vs cfc8cd5:** Improvement (overlay vs permanent rail), but interaction trap regresses manual flow.  
**Fix applied (Phase E):** Backdrop uses `SET_EXCHANGE_OPEN false`; auto-close on `mixer` room entry.

### 3. Global lane surface still reads slightly dashboard-like (severity: medium)
**Question:** Still dashboard?  
**Finding:** Integrated rows help, but STATUS / Launch columns + ruler still resemble admin table; score blocks are small relative to metadata columns.  
**vs cfc8cd5:** Major improvement — single surface replaces split table + collapsible timeline.  
**Remaining:** Widen score lane % in a future pass (not this bounded correction).

### 4. Three workspaces legible but desk identity weak in Global (severity: low–medium)
**Question:** Different workspaces per room?  
**Finding:** Global / Participant / Mixer are visually distinct (yes). Participant strip in top bar is compact; Global rows show owner initials adequately.  
**vs cfc8cd5:** Clearer room separation; less cast clutter.  
**Remaining:** No explicit “Private desk vs Shared Master” chip on Global (master meter only).

### 5. Greatest confusion element: dual library surfaces + Share entry points (severity: medium)
**Question:** Greatest confusion element?  
**Finding:** Participant had Library drawer toggle, Create “Save to library / Share to Exchange,” and Exchange top-bar — three publish paths without hierarchy.  
**vs cfc8cd5:** Same underlying model, but v3 promised fewer legends.  
**Partial fix:** In-editor library panel hidden; drawer remains canonical private library.

---

## Acceptance checklist (owner 1–13, inferred)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Three distinct room layouts | **Pass** (screenshots 01, 02, 08) |
| 2 | No permanent Exchange rail | **Pass** (overlay only) |
| 3 | No permanent Presence rail | **Pass** |
| 4 | One track representation in Global | **Pass** (lane row = launcher + inline score) |
| 5 | Horizontal participant tabs | **Pass** |
| 6 | Exchange overlay/drawer only | **Pass** (with Phase E close fix) |
| 7 | Mixer full-screen performance, no Exchange | **Pass** (toggle hidden) |
| 8 | No automation / walkthrough wired | **Pass** |
| 9 | `?presentation=v3` switch, legacy default | **Pass** |
| 10 | CSS Modules only in presentation-v3 | **Pass** |
| 11 | shellStore adapter, no new semantics | **Pass** |
| 12 | Compact 1280×720 behavior defined | **Pass** (contract + viewport hook) |
| 13 | Manual 60–90s sequence documentable | **Pass** (see `artifacts/presentation-v3/walkthrough.md`) |

---

## Verdict

v3 is a **credible parallel presentation layer** vs `cfc8cd5` dashboard shell. Top blocker (#1 editor dominance) partially addressed; #2 overlay trap fixed. Ready for **owner manual approval** with remaining polish scoped to a follow-up package (score-lane proportion, publish-path copy).
