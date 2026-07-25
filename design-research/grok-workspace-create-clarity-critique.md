# Grok Cold-Viewer Audit: Workspace Separation & Create Clarity

**Context:** Phase 5 live-collab presenter at HEAD `0dc374e`. Owner feedback:

1. 「現在還是感覺共用一個區域的感覺」 — still reads as one shared canvas, not four distinct participant desks.
2. 「Create的那個視圖讓人看不太懂」 — Create view is opaque (mode vs piano? desk audition? toolbar?).

**Audit lens:** First-time viewer watching the Four-Brain walkthrough with no codebase knowledge.

---

## Why it reads as one shared area

| Signal | What viewer sees | Inference |
|--------|------------------|-----------|
| **Full-width center pane** | Participant desk fills the same `focus-center` real estate as Global Arrangement | "I'm still in the same room, just a different tab." |
| **Weak desk identity** | Header `Kai · Keys Desk` is small; accent is a 3px left border at ~4% tint | Participant color doesn't own the surface |
| **No private/public boundary** | Subtitle shows draft id but never contrasts with Shared Master | "Is this editing the song everyone hears?" |
| **Global zone chips only in global room** | Switching to participant removes Workspaces / Arrangement / Shared Master chips entirely | Good for focus, but **no replacement frame** — viewer loses spatial anchors |
| **Presence rail is the only multi-user cue** | Four names in a sidebar; center is monolithic | Collaboration = avatars, not four rooms |
| **Room nav label** | `Ryo Desk` / `Kai Desk` in top nav is subtle vs `Global Studio` | Desk switch feels like filter, not teleport |

**Root cause:** Participant workspace is a **content swap inside one shell**, not a **visually bounded private room**. Per-participant state exists in the store (`participantWorkspaces`) but projection is under-signaled.

---

## Why Create is opaque

| Element | Viewer confusion |
|---------|------------------|
| **Piano Roll / Step / Clip tabs** | No legend for what each mode edits or which desk defaults to which |
| **Toolbar density** | Banner, mode tabs, lane chips, device link, desk audition in one row — no grouping |
| **Clip identity** | Draft id buried in desk header subtitle; not repeated in editor |
| **Desk audition** | Label "Desk audition" doesn't explain preview vs Shared Master transport |
| **Step grid** | Looks like a generic 16-pad UI; no "private rhythm desk" context |
| **Piano roll** | Notes appear without mode label; velocity inspector reads as DAW chrome |
| **Handoff captions** | `Desk: edit kai-lh-sparse-4` is engineer-speak, not "Private desk · shaping clip" |

**Root cause:** Create assumes the viewer knows desk-local semantics. The UI shows controls before **scope** (private) and **intent** (which editor mode, which clip).

---

## Bounded fix direction (implemented)

### Workspace separation

| Change | Rationale |
|--------|-----------|
| Inset desk card in `focus-center--participant-desk` (max-width, shadow, entry animation) | Center no longer reads as full-width shared canvas |
| Possessive desk title (`Kai's Keys Desk`) + instrument summary | Stronger identity per participant |
| `Private workspace` badge + "not Shared Master" in subtitle | Explicit private/public fence |
| Per-desk gradient wash + 4px accent border | Color owns the room |
| `focus-shell--participant-desk` dimmed canvas well | Global vs desk spatial contrast |

### Create clarity

| Change | Rationale |
|--------|-----------|
| `create-context-header` with clip name, revision, scope badge | Clip is the hero object |
| Mode label + legend per sub-mode/profile | Answers "what am I editing?" |
| Toolbar split: primary (mode) / secondary (preview, devices) | Reduces toolbar noise |
| `Desk preview` + `local only · not Shared Master` | Preview vs master distinction |
| Empty-state hint on piano roll; step hint for Rhythm | Onboarding without a tutorial |
| Handoff: `Private desk · shaping {draft}` on Create entry | Caption matches viewer language |

**Out of scope:** Real multiplayer cursors, four simultaneous desks on screen, full DAW semantics.

---

## Re-capture note

**Recommended** for `phase5-narrative-walkthrough` after this pass:

- Beats entering participant Create (Kai LH, Mei alto, Ren guitar): inset desk frame, possessive title, Create legend visible.
- Desk preview beats: `local only` hint legible in capture resolution.
- Room transitions: entry animation may need 300ms settle before record.

---

## Verdict

The prototype had correct **state** separation (per-participant workspaces) but weak **visual** separation. Create had the right controls but wrong information hierarchy. Bounded chrome + copy changes target viewer inference without expanding scope.
