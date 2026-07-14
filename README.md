# dabasemint

**The complete, healthy, high-UX visual intelligence + composition + agentic workshop for /forge toolchests.**

A local-first, dark-neon web app (Vite + vanilla JS) with an optional Tauri desktop wrapper, plus a terminal CLI. The agent layer calls **Novita** and **G0DM0D3 GLM (Zhipu)** LLMs server-side so API keys never reach the browser.

## Quick Start

### Web
```bash
cd /Users/kc/dabasemint
npm install
npm run verify      # health checks
npm test            # real-function test suite (16 checks)
npm run serve       # http://localhost:4174
```

### CLI
```bash
node bin/dabasemint.mjs register /path/to/toolchest
node bin/dabasemint.mjs list
node bin/dabasemint.mjs assay page-agent-toolchest   # live AI assay from the terminal
node bin/dabasemint.mjs status
```
The CLI registry lives at `~/.dabasemint/registry.json` and can be imported into the web app via **Import Registry**.

### Tauri Desktop
```bash
npm run tauri:dev    # development (agent routes via `npm run serve`)
npm run tauri:build  # production bundle
```
In production the desktop app spawns `node agent-proxy.mjs` as a managed sidecar (tracked + killed on quit), reads its port from `~/.dabasemint/agent-proxy-port.json`, and the UI talks to it directly. **Requires Node.js on the host.**

## How the UI is wired

`src/main.js` is an ES module, so every handler used by an inline `onclick`/`ondrop` attribute is explicitly exported to `window` / `window.dabasemint` (see the `WINDOW EXPORTS` block). The test suite enforces this so buttons can never silently break again.

## Features

- **Real disk loading** — `+ Register` picks a toolchest folder (native Tauri picker or browser File System Access API). Deep parsing of modules, `contracts.md`, READMEs, `.forge-state.md`.
- **Anatomy view** — module inspector, contracts preview from disk, dependency overview.
- **Health & Richness scoring** + per-toolchest + global **Health Dashboard**.
- **Search + source filters** + agent-applied tags + Collections tag cloud.
- **Composition Canvas** — drag & drop, reorder, blueprint health score, export (JSON + `CONNECTION.md`), and **Export as Real Project** scaffold.
- **Mint Blueprint** — turns a selection into a first-class library entry.
- **Agent touchpoints** (8): assay, find-complements, composition-advisor, generate-blueprint-docs, build-context-pack, context-pack-generator, gap-analysis, reusability-audit.
- **Trade Routes** — cross-toolchest synergy discovery.
- **Registry Import/Export, Compare, Snapshots, Command Palette (⌘K)**.

## Agent Layer

Keys resolve from (in order): env var → `config/agent.local.json` (copy `config/agent.local.json.example`) → `~/.pi/agent/auth.json` (GLM only). Robust retry/backoff, structured JSON extraction, and per-touchpoint validation. Unconfigured providers are visibly marked in the UI dropdown.

## Project layout

```
src/main.js             # UI: library, anatomy, composition, agents, rendering
src/toolchest-loader.js # disk ingestion (native + browser FS)
src/agent-provider.mjs  # provider abstraction, retries, JSON parsing
src/agent-touchpoints.mjs # 8 structured agent tasks + prompts + validation
agent-proxy.mjs         # standalone HTTP sidecar (used by Tauri)
scripts/serve.mjs       # web dev server + agent routes
scripts/e2e-test.mjs    # npm test
scripts/verify.mjs      # health checks
bin/dabasemint.mjs      # terminal CLI
src-tauri/              # Rust desktop wrapper (sidecar spawn/kill, native FS)
```

## Philosophy

- Manual & sovereign (you control every toolchest)
- Composition is the goal
- **Pi everywhere** is the canonical activation for the full sovereign agentic layer (user\'s explicit instruction — replaces agentic-core and is not referred to as "Pi enabled")
- Agents are powerful accelerators, not required
- Visual masterpiece first
- Local-first; keys stay server-side

## Pi Everywhere Activation

Run `/pi-everywhere` (or the `.pi-everywhere` marker is present) to activate your main `~/.pi` instance in this project. All agent touchpoints, composition intelligence, Mint Knowledge Graph, and health runs now route through the full Pi sovereign system.
