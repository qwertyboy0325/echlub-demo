# Collaboration Color Grammar

Four **independent** color systems. Collapsing them causes SaaS-dashboard confusion.

## 1. Participant identity

Fixed fixture palette (owner spec):

| ID | Name | Hex | Applied to |
|----|------|-----|------------|
| p1 | Alex | `#e76f51` | Avatar, cursor label, Exchange author left-stripe |
| p2 | Jordan | `#2a9d8f` | Same |
| p3 | Sam | `#e9c46a` | Same |

**Rules:**
- Never use participant colors for UI chrome, primary buttons, or panel backgrounds
- Presence "active" row uses neutral `--raised`, not participant fill
- Cursor label text: `#111` on participant background for contrast

## 2. Track / clip identity

Clip color derives from **lifecycle + arrangement state**, not participant color alone.

| Clip state | Visual grammar |
|------------|----------------|
| Exchange Available | Muted title, no stripe or muted stripe |
| Exchange In Progress | `--focus` lifecycle chip |
| Exchange Review | `--recording` lifecycle chip |
| Exchange Ready | `--ready` lifecycle chip |
| Arrangement staged | Lane `--selection` border; title shows contributor |
| Arrangement active | Lane `--active-shared` tint + border |

Author provenance: 3px left stripe = participant color (metadata only).

## 3. Workflow state (Exchange queue)

Exactly four lifecycle values — no fifth chip:

```text
Available    → muted / neutral chip
In Progress  → focus accent
Review       → recording accent  
Ready        → ready accent
```

sortablejs reorder does not change chip color — only position.

## 4. Selection / interaction state

| Interaction | Color token |
|-------------|-------------|
| Tab active | `--focus` underline |
| Note selected | `--focus` 2px border |
| Follow enabled | `--focus` chip border |
| Follow locked | `--focus` filled chip |
| Snap target | `--focus` dashed border |
| Hover row | `--hover` background |

**Independence test:** At any screenshot, a viewer must answer four questions without ambiguity:
1. Who? → participant identity
2. What clip lifecycle? → workflow chip
3. Is it staged/active on Master? → arrangement grammar
4. What is selected/followed? → selection state

## Preview / recording / Master (audio mode — fifth orthogonal axis)

Not a replacement for the four systems above:

| Mode | Badge | Meter fill |
|------|-------|------------|
| PREVIEW | `--preview` | green family |
| CAPTURE | `--recording` | red family |
| MASTER | `--master` | gold/amber family |

Dock slot shows **at most one** badge. Mixer may show all three modes across different slots simultaneously.

## Direction-specific accent mapping

| System | A | B | C |
|--------|---|---|---|
| Focus/selection | Cool blue-gray | Warm amber | Broadcast red |
| Master | Gold-brown | Amber (= warm) | Tally gold |
| Recording | Desaturated red | Warm red | Broadcast red |

Participant hex values **do not change** across directions.

## Anti-patterns

- Using Jordan's teal as the global "primary button" color
- Gradient lifecycle chips
- Participant-colored arrangement lanes (lane state uses semantic tokens only)
- Badge soup: more than 1 badge per dock slot
