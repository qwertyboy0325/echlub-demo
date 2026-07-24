# Accessibility and Contrast

Target: WCAG 2.1 AA for presenter/demo surfaces at 1280×720 recording resolution.

## Contrast pairs (computed on dark surfaces)

### Direction A

| Pair | Ratio | Pass |
|------|-------|------|
| `#e6e6e6` on `#1a1a1a` | ~11.5:1 | AAA body |
| `#8a8a8a` on `#1a1a1a` | ~5.2:1 | AA muted |
| `#4a7fa8` on `#1a1a1a` | ~4.8:1 | AA large / UI |
| `#e76f51` stripe on `#222` | ~4.6:1 | AA large |

### Direction B

| Pair | Ratio | Pass |
|------|-------|------|
| `#ece8e4` on `#211e1c` | ~12:1 | AAA |
| `#9a928a` on `#211e1c` | ~5.5:1 | AA |
| `#d4a574` on `#2a2623` | ~5.8:1 | AA |
| `#c4956a` MASTER border on `#2a2623` | ~4.9:1 | AA |

### Direction C

| Pair | Ratio | Pass |
|------|-------|------|
| `#f2f2f2` on `#161616` | ~13:1 | AAA |
| `#d44d2a` on `#161616` | ~5.1:1 | AA |
| `#9a9a9a` on `#161616` | ~5.8:1 | AA |

## Non-color redundancy

Every color-encoded state has a **text or shape redundant cue**:

| State | Color + redundant |
|-------|-------------------|
| Lifecycle | Chip text label |
| Staged vs active | Lane label includes "staged" / "active" |
| Follow | Chip text "Follow ○/●" + Lock icon |
| PREVIEW/MASTER | Badge text |
| Snap target | Dashed border + "snap" copy |

## Focus visibility

- Keyboard focus: 2px `--focus` outline, `outline-offset: 2px`
- No focus trap inside fixture shell
- Follow lock must be reachable via keyboard (implementation phase)

## Touch targets (Mixer / Dock)

| Control | Min size | Direction |
|---------|----------|-----------|
| Dock slot | 80×100px hit area | All |
| Knob | 48px (A/C) / 64px (B) | Per direction |
| Fader | 44px wide hit strip | B |
| Transport button | 32×32px | All |

## Motion sensitivity

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Follow mode projection transitions disabled under reduced-motion.

## 1280×720 legibility audit

| Element | Min effective size | Status |
|---------|-------------------|--------|
| Lifecycle chip | 9px uppercase | Pass all directions |
| Clip title | 11px | Pass |
| Transport readout | 12px mono | Pass |
| Exchange drawer trigger | 48px icon target | Pass compact mode |

## Known risks

- **B MASTER + selection same hue:** Distinguish by border style (solid vs double) in implementation
- **C broadcast red on small chips:** Ensure 9px uppercase still meets 4.5:1 — use `#e85a34` for chip text if needed
- **Participant cursor labels:** `#111` text on saturated backgrounds — verify per participant hex

## Recording contrast

Presenter recordings at 720p with H.264 compression lose ~8% contrast. Directions A and C retain more legibility after compression than B's warm muted pairs — factor into owner choice.
