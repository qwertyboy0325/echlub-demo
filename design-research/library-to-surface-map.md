# Library-to-Surface Map — Option B

| UI Surface | Primary library | Secondary | Custom work |
|------------|-----------------|-----------|-------------|
| App shell / layout | **dockview** | split.js inner splits | Presenter mode projection |
| Presence rail | vanilla DOM | — | Avatar, task chip components |
| Global arrangement | canvas 2D | interact.js drop targets | Clip slot model |
| Shared Clip Exchange | vanilla DOM + sortablejs | interact.js drag-out | Lifecycle chips, lineage |
| Participant editor tabs | dockview panels | — | Tab definitions |
| Piano roll | **canvas 2D** | — | Note model, hit testing |
| Step sequencer | vanilla DOM grid | — | Cell activation |
| Devices / FX rack | vanilla DOM | @floating-ui/dom | Param refs for dock map |
| Automation lane | canvas 2D | — | Curve handles |
| Mixer channels | custom web components | — | Fader, meter |
| Live Control Dock | **custom web components** | interact.js slot drop | 8-slot grid, sync |
| Transport bar | vanilla DOM | — | Tone transport bind (Phase 4) |
| Inspector / popovers | @floating-ui/dom | native popover | — |
| Queue inspector | sortablejs | — | Handoff metadata |
| Presenter transitions | GSAP (Phase 4) | CSS | Shell only in 3A |

## Dependency add list (post-approval)

```json
{
  "dockview": "^7.0.2",
  "@interactjs/types": "^1.10.x",
  "interactjs": "^1.10.x",
  "@floating-ui/dom": "^1.6.x"
}
```

`sortablejs` already present on archive branch; re-add to rewrite worktree at Phase 3.

## Bundle estimate (gzip)

| Addition | ~KB |
|----------|-----|
| dockview | 50–80 |
| interactjs (modular) | 20–40 |
| floating-ui | 5–8 |
| custom canvas/WC | 15–25 |
| **Total new** | **90–150** |

Acceptable for desktop presentation demo.
