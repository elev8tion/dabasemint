# dabasemint

**The complete, healthy, high-UX visual intelligence + composition + agentic workshop for /forge toolchests.**

A local-first, dark-neon web app (Vite + vanilla JS) with an optional Tauri desktop wrapper, plus a terminal CLI. The agent layer calls **Novita** and **G0DM0D3 GLM (Zhipu)** LLMs server-side so API keys never reach the browser.

## Quick Start

### Web
```bash
cd /Users/kc/dabasemint
npm install
npm run verify      # 14 health + structural checks
npm test            # 18 e2e checks
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

### UX shell (2026-07-14 overhaul)
- **Five primary tabs** — Library · Anatomy · Blueprint · Agents · Exports, plus an **Advanced** menu (Snapshots, Trade Routes, Registry IO, Provider Settings).
- **First-run onboarding** — a guided tour auto-shows on fresh storage; replay via the **Tour** button. A dismissible **Start here** panel sits above the library.
- **One main workflow** — `✨ Create a project from toolchests` opens a 5-step wizard (pick toolchests → choose modules → review conflicts → generate docs → export).
- **Actionable empty states** on every tab, with direct action buttons.
- **Glossary tooltips** — hover any underlined term (toolchest, blueprint, mint, assay, trade routes). Source of truth: `docs/GLOSSARY.md` ↔ the `TERMS` object in `src/main.js`.
- **Action feedback** — success cards (not just toasts) with links and **Undo** for destructive actions (remove toolchest, clear blueprint).
- **Contextual next-steps** card at the bottom of the active tab.
- **Light + dark theming** via CSS custom properties.

### Library & search
- **Real disk loading** — `+ Register` picks a toolchest folder (native Tauri picker or browser File System Access API). Deep parsing of modules, `contracts.md`, READMEs, `.forge-state.md`.
- **Health & Richness scoring** + per-toolchest + global **Health Dashboard**.
- **Command-center search** — natural-language-ish (“auth modules”), multi-field (name, README, contracts, tags), filter chips (source / role / contracts-only / min health), and **saveable searches**.
- **File-status badges** per toolchest — Connected / Missing / Changed / Permission — polled on focus + every 60s.
- **Collections** tag cloud.

### Anatomy
- **Module inspector** — role, LOC, contracts preview from disk, dependency overview.
- **Side-by-side compare** — tick up to 4 modules to compare reusability, best-for, contracts, and “hard to transplant” warnings.

### Blueprint & composition
- **Composition Canvas** — drag & drop, reorder, blueprint health score, export (JSON + `CONNECTION.md`).
- **Mint Blueprint** — turns a selection into a first-class library entry.
- **Export preview** — before generating a real project, preview the folder tree, files to generate, naming conflicts, and missing contracts/READMEs, then click **Generate project**.
- **Export as Real Project** scaffold + “Open folder” / “Copy next prompt”.

### Agents
- **Agent Actions panel** — a button grid (Analyze, Recommend, Explain, Find missing, Generate docs, Audit) with a metadata strip (last run, confidence, time, provider) and an expandable raw result.
- **Agent touchpoints** (8): assay, find-complements, composition-advisor, generate-blueprint-docs, build-context-pack, context-pack-generator, gap-analysis, reusability-audit.
- **Trade Routes** — cross-toolchest synergy discovery (under Advanced).

### Power tools
- **Registry Import/Export, Compare, Snapshots, Command Palette (⌘K)** (most under Advanced).

## Agent Layer

Keys resolve from (in order): env var → `config/agent.local.json` (copy `config/agent.local.json.example`) → `~/.pi/agent/auth.json` (GLM only). Robust retry/backoff, structured JSON extraction, and per-touchpoint validation. Unconfigured providers are visibly marked in the UI dropdown.

## Documentation map

| Doc | Purpose |
|-----|---------|
| `README.md` | How to run and operate the project (this file) |
| `docs/CURRENT-STATE.md` | Living snapshot of what’s implemented + verification baseline |
| `docs/GLOSSARY.md` | Single source of truth for terminology (mirrors the in-app `TERMS` tooltips) |
| `docs/archive/` | Superseded planning/session docs — audit trail only, not current guidance |

## Project layout

```
index.html              # app shell: tab bar, Start here, section anchors
src/main.js             # UI orchestration: tabs, wizard, tour, search, compare, agents
src/styles.css          # dark-neon theme + light/dark tokens
src/toolchest-loader.js # disk ingestion (native + browser FS)
src/agent-provider.mjs  # provider abstraction, retries, JSON parsing
src/agent-touchpoints.mjs # 8 structured agent tasks + prompts + validation
agent-proxy.mjs         # standalone HTTP sidecar (used by Tauri)
scripts/serve.mjs       # web dev server + agent routes
scripts/e2e-test.mjs    # npm test (18 checks)
scripts/verify.mjs      # npm run verify (health + structural checks)
bin/dabasemint.mjs      # terminal CLI
src-tauri/              # Rust desktop wrapper (sidecar spawn/kill, native FS)
config/                 # agent.local.json(.example)
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
