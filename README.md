# dabasemint (Enhanced)

**The complete, healthy, high-UX visual intelligence + composition + agentic workshop for /forge toolchests.**

**✅ Strategic Plan Completed + Final Polish** — Risky flows (loading, agents, composition) hardened with better validation, matching, and user guidance.

## Quick Start (Web)

```bash
cd /Users/kc/dabasemint
npm run verify
npm run serve
```

Open http://localhost:4174

## Tauri Desktop Wrapper

```bash
npm run tauri:dev   # development
npm run tauri:build  # production build
```

**Improvements in this build**:
- Native folder picker via Rust (much more reliable than browser File System Access API)
- Native reading of `.forge-state.md`, modules, and contracts
- **Agent proxy sidecar** (`agent-proxy.mjs`) — automatically started inside the Tauri app
- No need to manually run `npm run serve` when using the desktop version
- Seamless fallback to browser mode when not in Tauri
- Status indicator shows when running natively

This makes the desktop experience much more self-contained and robust.

**Recommended flow**:
1. Click + Register → select one of your real toolchests using the picker (supports your page-agent, captions-site, Glaze)
2. Explore Anatomy — click modules for deep inspector (contracts preview from disk)
3. Drag modules into Composition Canvas (reorder supported)
4. Run Trade Routes or Composition Advisor
5. Mint Blueprint (creates a first-class entry) or Export (JSON + CONNECTION.md)

The app now gives you real superpowers over your toolchests.

## Major Enhancements (current)

- **Real disk loading** — Click "+ Register" and pick a toolchest folder (File System Access API). Deep parsing of modules, contracts.md, READMEs.
- **Deep Module Inspector** — live contracts.md preview from disk.
- **Health & Richness scoring** + dynamic Blueprint Health
- **Search + filters** + agent-applied tags + Collections tag cloud
- **Interactive Composition Canvas**: drag & drop, reorder, health score, rich export (JSON + CONNECTION.md)
- **Mint Blueprint** flow — turns your selection into a first-class minted entry
- **Actionable agents**: Assay, Complements (auto-add), Trade Routes, Context Pack
- **Agent History**
- **Live refresh** from stored handles
- Excellent support for page-agent (contracts), captions-site, Glaze

## Agent Layer

Uses Novita + G0DM0D3 GLM via local proxy.

Put keys in `config/agent.local.json`.

Touchpoints:
- assay-toolchest
- composition-advisor
- find-complements
- gap-analysis
- etc.

## Philosophy

- Manual & sovereign (you control every toolchest)
- Composition is the goal
- Agents are powerful accelerators, not required
- Visual masterpiece first
- Full curation, versioning, and registry management

**The strategic plan is now complete.** See STRATEGIC-PLAN.md for the full vision and current status.
