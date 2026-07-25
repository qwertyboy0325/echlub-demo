# Live-Collab Presenter — Component Polish Pass

Cold-viewer legibility pass across nine UI zones. Visual-only; walkthrough timing unchanged.

## 1. Presence rail
- Active participant: left accent bar + participant-color border (`--presence-accent`)
- Editing state: verb label tinted with participant color (`presence-person--editing`)
- Forking state: verb in recording red (`presence-person--forking`)

## 2. SESSION table
- Sticky column headers with stronger letter-spacing
- Clip names in mono (`session-lane-clip-name`)
- State column as pill badges (empty / loaded / queued / playing)
- Loaded + playing row backgrounds differentiated

## 3. ARRANGEMENT score map
- Denser track rows (44px) for 7-lane fit
- Mono clip titles with ellipsis
- Combined payoff: zone tint + active block glow (`global-zone--arrangement-combined`)
- Playhead glow for visibility

## 4. SHARED MASTER
- Payoff zone when 7/7 or performing (`global-zone--master-payoff`)
- Meter gradient fill at payoff (`master-strip--payoff`)
- Lane count stacked readout typography

## 5. Shared Clip Exchange
- READY rows: green left rail (`exchange-row--ready`)
- AVAILABLE: dashed lifecycle chip
- Fork audition panel accent (`exchange-compare-panel--promote`)
- Stronger selected-row inset ring

## 6. Participant Create desk
- Toolbar subtle background lift
- Desk audition group bordered when active (`:has(.create-audition-btn--active)`)

## 7. Caption / handoff strip
- `Now` / `Thread` micro-labels
- Vertical feed with dot markers; latest entry highlighted

## 8. FocusShell chrome
- Zone chip bar bottom border + background
- Shared Master chip shows `· N/7` when lanes live
- Perform banner subtle glow (respects reduced-motion)

## 9. Perform / Recall / Promote
- Promote button: uppercase pill with accent fill
- Performing badge: bordered pill (session + exchange)
- Recall chip: mono uppercase with desk accent

## Re-capture
**Recommended** for `phase5-narrative-walkthrough` — payoff zones (SESSION state pills, score map combined highlight, master meter, perform banner, caption strip) are visual-only.
