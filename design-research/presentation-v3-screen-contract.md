# Presentation V3 — Screen Contract

**Date:** 2026-07-25  
**Baseline:** `cfc8cd5`  
**Branch:** `presentation/fullscreen-rooms-v3`  
**Authority:** Owner presentation recovery — parallel layer only. No domain/collaboration changes. No automation in v3.

**Design direction:** Precision Shell, Console Hands (global chrome A + tactile B scoped to Devices/Mixer/Dock).

---

## 1. Global Performance Room — 1440×900

**Canvas:** Full viewport minus 48px top bar and 52px transport footer → ~1340×800 content.

| Zone | Height | Content |
|------|--------|---------|
| Top bar | 48px | StudioTopBar: brand, room pills, compact participant avatars (4), Exchange toggle, session phase chip |
| Main | flex 1 | **One integrated 7-lane surface** — not table + separate timeline |
| Transport | 52px | Play/Pause, bar readout, Shared Master hint, Restart |

**Integrated lane surface (single panel):**
- 7 horizontal rows, one per Shiki lane (Drums → Guitar color).
- Each row: owner initial (24px) · track name · clip/material label · lifecycle state chip · **inline score bar** (4–8 bars wide, playhead) · Launch / Promote / Playing badge.
- Rows share one left ruler column (bars 1–16) — score segments render inside the row, not in a second scroll region.
- Header strip inside main: `Building Shared Song` / `Performing Shared Song` + `Shared Master · N/7` readout.
- Footer strip inside main: master meter (N/7 fill) + sparse/performing copy.

**Exchange:** Overlay drawer only (right, 360px). Toggle from top bar. Never a permanent right rail.

**Absent:** PresenceRail, zone chip banners, separate “Shared lanes table” + “Arrangement score map” sections, presenter captions, choreography targets as primary chrome.

---

## 2. Participant Desk Room — 1440×900

**Canvas:** Same chrome grid as Global.

| Zone | Width / height | Content |
|------|----------------|---------|
| Top bar | 48px | StudioTopBar (participant desk name in nav pill) |
| Header | 56px compact | Avatar · desk title · `rN` · one-line instrument summary · **one** `Private` badge |
| Library drawer | 240px collapsible left | Private clips list; default **collapsed** to icon strip; expand via “Library” control |
| Editor | 70–85% width | Dominant — Create / Devices / Automation / Mix / Queue |
| Transport | 52px | Same as Global |

**Tabs:** Horizontal `TabList` directly under compact header (Create | Devices | Automation | Mix | Queue). No vertical sidebar tabs.

**Create tab:** Reuse `CreateEditor` (piano / step / clip submodes). Editor body ≥ 72% of main column height.

**Absent:** Permanent Exchange rail, PresenceRail, multi-row zone chips, `focus-participant-zones` banner stack, recall chip unless recall state active (then single inline chip only).

---

## 3. Mixer Performance Room — 1440×900

**Canvas:** Top bar 48px · mixer body flex 1 · dock 120px (8 slots).

| Zone | Content |
|------|---------|
| Mixer header | `Performance` label · dock mode readout |
| Channel grid | 4 desk groups (Rhythm/Keys/Horns/Guitar): avatar, owner, tracks, meter, filter/delay/reverb, Select/Mute |
| Live Control Dock | 8 slots, Preview/Capture/Master mode pills — tactile B tokens scoped here |

**Absent:** Exchange toggle hidden/disabled in mixer room (no overlay entry). No participant strip expansion. No arrangement lanes.

---

## 4. Compact 1280×720 behavior

Trigger: viewport width &lt; 1320px OR `?viewport=compact`.

| Change | Wide 1440×900 | Compact 1280×720 |
|--------|---------------|------------------|
| Top bar | Full participant strip (4 avatars + names on hover) | Avatars only, 32px |
| Global lanes | Full inline score bars | Score bars compress to 4 bars visible; horizontal scroll within row |
| Library drawer | Collapsed default | Force collapsed; overlay expand |
| Dock slots | 8 | 6 |
| Typography | 13px body, 10px labels | 12px body, 9px labels |
| Min touch | — | 36px min control height |

Root container: `max-width: 100vw; max-height: 100vh; overflow: hidden` — rooms scroll internally, not the page.

---

## 5. Visual hierarchy

1. **Primary musical surface** (largest, highest contrast): Global integrated lanes · Participant Create editor · Mixer channel strips.
2. **Shared Master consequence** (secondary): master meter, transport hint, playing badges — always visible in Global/Mixer, never competing with primary surface.
3. **Collaboration queue** (tertiary, on demand): Exchange overlay — lifecycle chips, compare panel.
4. **Chrome** (lowest): top bar, transport — `--shell-canvas` background, 1px separators.

Color grammar (unchanged): participant colors on lane provenance and desk avatar only; lifecycle chips use semantic tokens; B warm focus ring **only** on dock/mixer faders.

---

## 6. Persistent vs transient controls

| Persistent (always visible in room) | Transient (overlay / contextual) |
|-------------------------------------|-----------------------------------|
| Room nav pills | Exchange drawer |
| Transport Play/Pause + bar | Library drawer (participant) |
| Global: integrated lanes + master meter | Compare parent/fork panel (inside Exchange) |
| Participant: horizontal tabs + editor | Desk audition banner (only when `deskAuditionDraftId` set) |
| Mixer: channels + dock | — |
| Compact participant avatars (global/participant) | Perform mode banner → inline session phase chip only |

**No** Follow controls, Run demo, walkthrough progress, or presenter caption strip in v3.

---

## 7. Manual 60–90s walkthrough script

**Audience:** Cold viewer, no automation. Operator drives clicks.

| Step | Time | Room | Action | Expected visible result |
|------|------|------|--------|-------------------------|
| 1 | 0:00 | Global | Land on sparse Global | 0/7 master meter, lanes mostly empty/loaded, transport hint mentions Launch |
| 2 | 0:08 | Participant | Top bar → Kai (Keys) | Compact header, Create tab, piano roll dominant |
| 3 | 0:18 | Participant | Step submode → edit a step cell | Grid updates; still Private badge |
| 4 | 0:28 | Participant | Preview clip (Create toolbar) | Desk audition active; transport plays private cue |
| 5 | 0:38 | Participant | Open Exchange overlay → Share revision | Clip appears Available in list |
| 6 | 0:48 | Global | Close Exchange; observe lanes | Same integrated surface; staged/loaded lane if fixture progressed |
| 7 | 0:55 | Global | Launch on first launchable lane | Lane → Playing; master meter 1/7; audible Shared Master |
| 8 | 1:05 | Mixer | Room nav → Mixer | Full channels + dock; no Exchange |
| 9 | 1:12 | Mixer | Adjust dock slot 0 knob / set Capture mode | Dock value changes; mode pill updates |
| 10 | 1:20 | Global | Return Global; Play transport | Hear launched lane + dock consequence on Shared Master readout |

**Total:** ~80s at deliberate pace.

---

## 8. Explicit kill list

Do **not** ship in v3 (keep in legacy path only):

- `FocusShell` layout, zone chip stacks, `focus-shell--*` grid
- `PresenceRail` permanent column
- `SharedClipExchange` permanent `variant="rail"`
- Split Global: session lane **table** + separate arrangement **timeline** sections
- `PHASE5_WALKTHROUGH`, `ChoreographyOverlay`, `choreographyForCommand`
- Automated captions (`PresenterCaptionStrip`, `handoffCaptions` driven UI)
- Auto room switching / Follow Active / presenter Run demo controls
- New shell commands or musical semantics
- Broad `style.css` edits or `[data-rac]` / `.room *` global selectors for v3
- Dashboard widgets: activity feed panel, projection caption, multi-badge legends
- Permanent Exchange or Presence rails in any room
- Vertical participant tabs
- Second timeline store or duplicate track representation

---

## Self-check (pre-implementation)

| Check | Status |
|-------|--------|
| One track representation in Global (lane row = launcher + score) | ✓ |
| Exchange overlay-only | ✓ |
| Three distinct room layouts | ✓ |
| Reuses shell store commands only | ✓ |
| No automation wired | ✓ |
| Compact behavior defined | ✓ |
| Contradiction: “no Exchange in mixer” vs top bar Exchange toggle | Resolved: toggle **hidden** in mixer room |
