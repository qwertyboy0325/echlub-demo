# Token Comparison — Directions A / B / C

Full CSS: `design-research/visual/tokens/direction-{a,b,c}.css`

## Surface hierarchy

| Token | A Precision | B Hardware | C Editorial |
|-------|-------------|------------|-------------|
| Canvas | `#131313` | `#181614` | `#0e0e0e` |
| Panel | `#1a1a1a` | `#211e1c` | `#161616` |
| Raised | `#222222` | `#2a2623` | `#1c1c1c` |
| Separator | `#333333` | `#3d3834` | `#2e2e2e` |
| Shadow | none | 1px drop on controls | none |

## Typography & text

| Token | A | B | C |
|-------|---|---|---|
| Primary text | `#e6e6e6` | `#ece8e4` | `#f2f2f2` |
| Muted | `#8a8a8a` | `#9a928a` | `#9a9a9a` |
| UI font | Inter | Inter | Source Sans 3 |
| Numeric font | IBM Plex Mono | IBM Plex Mono | Source Code Pro |

## Interaction states

| Token | A | B | C |
|-------|---|---|---|
| Selection | `#3d6a8a` | `#c4956a` | `#d44d2a` |
| Focus | `#4a7fa8` | `#d4a574` | `#e85a34` |
| Hover surface | `#2a2a2a` | `#322e2a` | `#242424` |

## Audio / workflow semantics

| Token | A | B | C |
|-------|---|---|---|
| Preview | `#5a7a5a` | `#6a9a7a` | `#4a7a6a` |
| Recording / Review | `#a84848` | `#c45a4a` | `#d44d2a` |
| Ready | `#6a8a5a` | `#8aaa6a` | `#5a8a6a` |
| Shared Master | `#7a6a4a` | `#c4956a` | `#c4a035` |
| Active Shared clip | `#4a7fa8` | `#d4a574` | `#e85a34` |

## Participant identity (shared across directions)

| Participant | Color | Use |
|-------------|-------|-----|
| Alex | `#e76f51` | Avatar, cursor, exchange author stripe |
| Jordan | `#2a9d8f` | Avatar, cursor, exchange author stripe |
| Sam | `#e9c46a` | Avatar, cursor, exchange author stripe |

**Rule:** Participant colors NEVER used for UI chrome, buttons, or panel accents.

## Track / clip identity

| State | Visual |
|-------|--------|
| Available | Muted label, no left stripe |
| In Progress | Focus accent lifecycle chip |
| Review | Recording accent chip |
| Ready | Ready accent chip |
| Staged (arrangement) | Selection border on lane |
| Active (arrangement) | Active-shared tint + border |

## Spacing & radii

| Token | A | B | C |
|-------|---|---|---|
| Panel radius | 2px | 4px | 0px |
| Control radius | 3px | 6px | 2px |
| Presence width | 200px | 200px | 200px |
| Exchange width | 320px | 320px | 320px |
| Transport height | 48px | 48px | 48px |
| Dock height | 112–140px | 112–140px | 112–140px |

## Motion

| Token | All directions |
|-------|----------------|
| Transition | `120ms ease` on border-color, background only |
| Reduced motion | `@media (prefers-reduced-motion: reduce) { transition: none }` |

## Separate color systems (mandatory)

1. **Participant identity** — Alex/Jordan/Sam hex only on avatars, cursors, author stripes
2. **Track/clip identity** — lifecycle chip + optional clip label tint (never equals participant color for unrelated data)
3. **Workflow state** — Available/In Progress/Review/Ready (4 chips only)
4. **Selection state** — focus ring, staged lane, selected note, snap target dashed border

Directions must not collapse these four systems into one accent hue.
