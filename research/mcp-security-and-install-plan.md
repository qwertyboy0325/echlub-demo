# MCP Security and Install Plan

**Status:** Recommendations only. No installation until owner reviews this report.

## Principles

- Prefer official vendor-maintained MCP servers
- Least privilege; read-only during research
- No repository secrets, private artifacts, or unrelated filesystem roots
- No personal credentials committed to repo

## Recommended additions (post-review)

### 1. Chrome DevTools MCP — **Recommend (debug tier)**

| Field | Value |
|-------|-------|
| Package | `chrome-devtools-mcp` |
| Maintainer | Google Chrome DevTools team |
| Source | https://github.com/ChromeDevTools/chrome-devtools-mcp |
| License | Apache-2.0 |
| Auth | None (local npx); optional `--autoConnect` needs user Chrome permission |
| Permissions | Launches/attaches Chrome; full page DOM, network, console, perf traces |
| Data exposure | Everything visible in attached browser tab |
| Maintenance | Active (v1.6.0, Jul 2026) |
| EchLub use | Source-mapped runtime failures, layout diagnostics, perf during shell QA |
| Safer fallback | `cursor-ide-browser` CDP (already available, narrower tool surface) |

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

### 2. Playwright MCP — **Recommend (regression tier)**

| Field | Value |
|-------|-------|
| Package | `@playwright/mcp` |
| Maintainer | Microsoft Playwright team |
| Source | https://github.com/microsoft/playwright-mcp |
| License | Apache-2.0 |
| Auth | None |
| Permissions | Browser automation; can persist sessions |
| Data exposure | Page content under test |
| Maintenance | Active (v0.0.78+, Jul 2026) |
| EchLub use | Viewport matrix (1440/1280/720), shell walkthroughs, screenshot/trace gates |
| Safer fallback | Existing `puppeteer-core` scripts in `scripts/` |

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

**Boundary vs Chrome DevTools MCP:** Playwright = deterministic regression; Chrome DevTools = deep interactive debug. Not concurrent on same page.

### 3. Context7 MCP — **Optional (docs tier)**

| Field | Value |
|-------|-------|
| Package | `@upstash/context7-mcp` |
| Maintainer | Upstash |
| Source | https://github.com/upstash/context7 |
| License | MIT |
| Auth | Optional API key (rate limits) |
| Permissions | Outbound HTTP to Context7 API |
| Data exposure | Library names + queries sent to Upstash |
| Maintenance | Active (v3.2.4) |
| EchLub use | Dockview v7, Tone.js 15, interact.js API verification |
| Safer fallback | Primary library docs + npm package README |

**Requirement:** Cross-check Context7 output against primary docs before implementation.

### 4. GitHub official MCP — **Defer**

| Field | Value |
|-------|-------|
| Use | Remote history/workflow verification |
| Status | Not needed locally; `gh` CLI available |
| Install | Only if cloud agent needs repo context without shell |

### 5. Figma MCP — **Unavailable**

Design skeletons delivered as static frames in `design-research/frames/`. Revisit if owner provides Figma access.

## Rejected MCP candidates

| Candidate | Reason |
|-----------|--------|
| Unknown community browser MCPs | Unverified maintainer |
| FinMind (installed) | Unrelated to EchLub |
| GitKraken write tools during research | Unnecessary privilege |

## Install sequence (after owner approval)

1. Add Playwright MCP to user `~/.cursor/mcp.json` (not repo)
2. Add Chrome DevTools MCP if cursor-ide-browser CDP proves insufficient
3. Add Context7 only during library integration spikes
4. Run disposable `npx` smoke in isolated terminal before persistent config

## Credential rules

- Store API keys in user env / Cursor secrets — never in `echlub-demo` repo
- Do not point MCP at `local-reconstruction/`, `reference-private/`, or `artifacts/owner-review/`
