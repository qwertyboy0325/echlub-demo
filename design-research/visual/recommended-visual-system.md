# Recommended Visual System

**Role:** STRONG_FINAL synthesis (Sol recommendation — requires owner approval, not self-approved)  
**Default recommendation:** Hybrid **A global chrome + B Devices/Mixer/Dock controls + C presenter typography**

---

## Recommended system: "Precision Shell, Console Hands"

### Global chrome (Direction A)

Apply A tokens to:
- Focus Shell grid (canvas, panel, raised, separator)
- PresenterNav, Presence rail, Exchange rail
- Global Studio arrangement lanes
- Participant Create (piano roll, tabs, header context)
- All workflow lifecycle chips (semantic colors from A palette)

**Rationale:** Lowest SaaS/dashboard risk; clearest collaboration color grammar separation.

### Tactile accent layer (Direction B — scoped)

Apply B control anatomy **only** in:
- Participant → Devices (chain node pads, inspector controls)
- Mixer / Performance (channel strips, meters, faders)
- Live Control Dock (8 slots: 64px knobs, 12px faders, warm `--focus` ring)

**Rationale:** Owner hypothesis validated — recording legibility and musical credibility peak where hands touch parameters.

**Hard boundary:** B `#c4956a` / `#d4a574` never appears on Exchange rows, arrangement lanes, or nav pills.

### Presenter typography (Direction C — borrowed)

Apply without C's broadcast red:
- Source Sans 3 **or** Inter 600 for room labels and section headers
- Source Code Pro / IBM Plex Mono for transport + param readouts
- 10px uppercase section labels at 0.1em tracking

**Rationale:** 1280×720 recording readability without editorial harshness (zero-radius panels stay A at 2px).

---

## Token package (implementation-ready)

Primary file: merge `tokens/direction-a.css` with B overrides:

```css
[data-room="devices"],
[data-room="mixer"],
[data-surface="live-control-dock"] {
  /* B control tokens only */
  --knob-size: 64px;
  --fader-width: 12px;
  --focus: #d4a574;
  --selection: #c4956a;
}
```

Full spec: `token-comparison.md` + `collaboration-color-grammar.md`

---

## Primitive stack

| Layer | Choice |
|-------|--------|
| Accessibility primitives | **React Aria Components** |
| Icons | **Lucide** |
| UI font | **Inter** (Source Sans 3 optional for nav headers) |
| Numeric font | **IBM Plex Mono** |
| Theming | CSS custom properties on `:root` + room scoping |
| Participant editor | Dockview custom theme (existing dep) |
| Controls | Purpose-built EchLub Knob/Fader/Toggle/Trigger/Meter — **no shadcn** |

---

## Component priority for Phase 3B (post-approval)

1. Token CSS + room scoping attributes
2. Live Control Dock slot + 5 control primitives
3. Exchange row + lifecycle chips
4. Arrangement lane states
5. Presence rail + Follow chip
6. Dockview theme pass

---

## Owner override paths

| If owner selects… | Action |
|-------------------|--------|
| Pure A | Drop B overrides; smallest implementation |
| Pure B | Accept Global SaaS risk; warm everything |
| Pure C | Sharp radii + broadcast red; swap fonts |
| Custom mix | Document scoping map before any `src/**` work |

---

## Acceptance criteria (visual gate exit)

- [ ] Owner confirms direction or hybrid scope in writing
- [ ] One contact sheet row approved at 1280×720 screenshot
- [ ] Kill list re-audit on chosen direction
- [ ] Participant colors unchanged from fixture spec
- [ ] No new library installs beyond 5ece39e set

**Stop line:** Owner art-direction approval → then Phase 3B token wiring authorized.
