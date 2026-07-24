# Typography and Iconography

## Primary typeface recommendation

**Inter** (Directions A + B) · **Source Sans 3** (Direction C editorial variant)

| Role | A / B | C |
|------|-------|---|
| UI labels | Inter 400/500 | Source Sans 3 400/600 |
| Section headers | Inter 600, 10px uppercase | Source Sans 3 700, 10px uppercase |
| Clip titles | Inter 500, 11px | Source Sans 3 600, 11px |
| Brand wordmark | Inter 600, -0.02em tracking | Source Sans 3 700 |

**Alternative if Inter unavailable:** IBM Plex Sans — similar metrics, slightly more technical.

**Do not use:** Geist as primary (reads Vercel/shadcn), SF Pro (platform-locked feel in browser), Poppins/Montserrat (marketing).

## Numeric / param typography

**IBM Plex Mono** (A/B) · **Source Code Pro** (C)

Applied to:
- Transport position (bar.beat.sub)
- BPM
- Param values in dock slots
- MIDI velocity / note readout
- Frame dimension labels (evidence only)

Features: `font-variant-numeric: tabular-nums` on all numeric readouts.

## Type scale (1440×900 baseline)

| Level | Size | Weight | Use |
|-------|------|--------|-----|
| xs | 9px | 600 | Lifecycle chips, badges |
| sm | 10px | 400–600 | Section labels, metadata |
| base | 11px | 400–500 | Row titles, tabs |
| md | 12px | 400 | Transport, nav |
| lg | 13px | 600 | Presenter nav room label |

**1280×720:** No size reduction below 9px effective. Compact mode hides text labels, not shrinks type.

## Iconography

**Library:** Lucide Icons (MIT, tree-shakeable, no emoji)

| Function | Icon suggestion |
|----------|-----------------|
| Follow | `Radio` or `Eye` (not animated) |
| Transport play | `Play` filled triangle in button |
| Share / fork | `Share2`, `GitBranch` |
| Devices | `Cable`, `Sliders` |
| Mixer | `Volume2` |
| Lock follow | `Lock` |
| Exchange drawer | `PanelRight` |

**Rules:**
- 16px icon size in nav; 14px inline
- Stroke 1.5px; color `--muted` default, `--text` on active
- No sparkle, magic wand, or emoji substitutes
- Icons always paired with text label except compact 48px presence avatars

## Direction-specific typography notes

### A — Precision Studio
- Minimal weight contrast (500 vs 600 only)
- Tight line-height 1.3
- No letterspaced body text

### B — Hardware Console
- Slightly larger control labels (10px → 11px in dock)
- Uppercase only on section labels, not control names

### C — Editorial Broadcast
- Strongest weight contrast (400 vs 700)
- Section labels at 0.1em tracking
- Room name in nav at 600 weight — presenter-readable at 720p

## Loading strategy

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet"/>
```

Self-host in production implementation; Google Fonts acceptable for static evidence frames only.
