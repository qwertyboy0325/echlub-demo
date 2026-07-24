# Available Tools, MCPs, and Execution Resources

Verified 2026-07-24 from Cursor MCP catalog, repo inspection, and owner environment.

## Cursor models (Task tool)

| Model slug | Status | EchLub role |
|------------|--------|-------------|
| `composer-2.5` | Available | Primary implementation executor (Phase 3+) |
| `composer-2.5-fast` | Available | Fast executor, specialist auditors |
| `gpt-5.6-sol-medium` | Available | Research orchestration (this phase) |
| `gpt-5.6-sol-high` | Available | Final conflict review (owner-gated per policy) |
| `gpt-5.4-medium` | Available | Alternative strong model |
| `claude-sonnet-5-thinking-high` | Available | Alternative |
| `claude-opus-4-8-thinking-high` | Available | Alternative |
| `cursor-grok-4.5-high` | Available | Independent design critic (this phase) |

## Subagents (`.cursor/agents/`)

| Agent | Status | Use |
|-------|--------|-----|
| `audio-timing-auditor` | Available | Read-only Tone/scheduling audit |
| `visual-interaction-auditor` | Available | Read-only layout/cursor audit |
| `scope-and-evidence-auditor` | Available | Read-only scope/evidence audit |
| `explore`, `generalPurpose`, `shell` | Available via Task | Bounded spikes |
| `bugbot`, `security-review` | Available | Post-implementation review |

## Installed MCP servers (this session)

| Server | Status | Tools |
|--------|--------|-------|
| `cursor-ide-browser` | **Ready** | navigate, snapshot, screenshot, click, drag, CDP, tabs |
| `user-eamodio.gitlens-extension-GitKraken` | **Ready** | git ops, PR/issue read (write available — avoid in research) |
| `user-local-lmstudio-delegate` | **Ready** | `delegate_to_local_model` (local Qwen) |
| `user-finmind` | **Ready** | Taiwan stock data — **unnecessary** for EchLub |
| `plugin-linear-linear` | **needsAuth** | Blocked until auth |

## Approved post-Gate-1 (owner §9)

| Resource | Status | Notes |
|----------|--------|-------|
| Playwright MCP (`@playwright/mcp@latest`) | **Approved** | User-level `~/.cursor/mcp.json`; deterministic walkthroughs |
| Chrome DevTools MCP (`chrome-devtools-mcp@latest`) | **Approved** | User-level install; deep debug only — never concurrent with Playwright on same page |

**Boundary:** Do not run Playwright MCP and Chrome DevTools MCP on the same page/profile concurrently.  
**Fallback:** `cursor-ide-browser` or repo `puppeteer-core` scripts if MCP not yet installed — does not block shell work.

## NOT installed (evaluated, not present)

| Resource | Status | Notes |
|----------|--------|-------|
| Chrome DevTools MCP | **Approved, user install pending** | See post-Gate-1 table |
| Playwright MCP | **Approved, user install pending** | See post-Gate-1 table |
| Context7 MCP | **Installable** | Upstash `@upstash/context7-mcp` |
| GitHub official MCP | **Installable** | Not configured |
| Figma MCP / plugin | **Not available** | No Figma integration detected |
| Playwright (npm dep) | **Not in repo** | Repo uses `puppeteer-core` for gates |

## Browser automation boundary

| Tool | Role | Boundary |
|------|------|----------|
| **cursor-ide-browser** | Interactive QA in owner session | Live page inspection; overlaps CDP with Chrome DevTools MCP |
| **puppeteer-core** (repo scripts) | Deterministic CI-style gates | Headless regression; existing investment |
| **Chrome DevTools MCP** (proposed) | Deep debug: perf traces, network, console | Attach to live Chrome; not for batch regression |
| **Playwright MCP** (proposed) | Deterministic walkthroughs, viewport matrix, traces | Replace ad-hoc puppeteer for new gates; keep puppeteer until migrated |

**Rule:** Do not run cursor-ide-browser and Playwright MCP against the same page concurrently. Use Playwright MCP for repeatable gates; cursor-ide-browser or Chrome DevTools MCP for exploratory debug.

## Filesystem and Git

| Capability | Status |
|------------|--------|
| Local git branches/worktrees | Authorized (archive + rewrite created) |
| Push/deploy | **Forbidden** this phase |
| `artifacts/` read | Available locally, gitignored |
| GitHub `gh` CLI | Available per user rules (not used this phase) |

## Design tools

| Tool | Status |
|------|--------|
| Figma MCP | Unavailable |
| Static HTML/SVG frames | **Used** — `design-research/frames/` |
| GenerateImage | Available for contact sheets |
| `scripts/capture-guided-demo.mjs` | On archive branch only; captures rejected demo |

## Screenshot and recording

| Asset | Path |
|-------|------|
| Rejected demo recording | `artifacts/demo-ready/guided-demo-full-run.webm` |
| Layout audits | `artifacts/demo-ready/guided-layout-audit-*.png/json` |
| Owner-review ZIP | `artifacts/owner-review/demo-ready-evidence.zip` |
| Failure reference copy | `artifacts/failure-reference/collaborative-studio-dashboard-rejected-2026-07-24/` |

## Skills (user-global, not repo)

Relevant: `architecture-review`, `implementation-planning`, `evidence-driven-debugging`, `change-review`, `review-agent`.

Not used: `job-search`, `resume-package`, `pdf`, `sdk`.
