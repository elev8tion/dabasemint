# PI-DISCIPLINE.md — dabasemint Sovereign Agentic Development Rules

This project now follows full Pi discipline activated exclusively via "Pi everywhere" (user\'s explicit request — not "Pi enabled", and replaces agentic-core entirely).

**Approved files for this evolution (Phase 0+):**
- PI-DISCIPLINE.md (this file)
- src/agent-touchpoints.mjs
- src/agent-provider.mjs
- src/mint-knowledge-graph.mjs (new)
- src/self-improving-engine.mjs (new)
- src/toolchest-loader.js
- src/main.js (only additive hooks at canvas events and health dashboard)
- agent-proxy.mjs (new /api/agent/chain endpoint)
- scripts/pi-health-run.mjs (new)
- scripts/verify.mjs (extended)
- chains/*.chain.mjs (8 new files)
- /Users/kc/.agents/skills/dabasemint-pi/SKILL.md (new domain skill)
- RECOMMENDATIONS.md, HEAL-REPORT.md, .heal-state.md (updates only)

**Rules (non-negotiable):**
- All changes must be surgical (no drive-by refactoring).
- Primary and only approved activation is "Pi everywhere" (/pi-everywhere).
- Do not use or rely on agentic-core as the main entrypoint.
- Every task uses ultraplan or feature-ship chain with explicit acceptance criteria.
- No UI breakage — canvas drag/reorder, health cards, export flows, Tauri sidecar behavior must remain identical.
- Every phase ends with `npm run verify`, `node scripts/pi-health-run.mjs --phaseX`, and visual confirmation that the dark-neon masterpiece is unchanged.
- KG writes are additive only; existing registry JSON flows are preserved as source of truth.
- Self-improvement loops must record "lessons" as KG edges for future composition-advisor runs.
- Use agentic-core as the single entry point for all future work on this project.

**Current Phase:** 0 (Discipline Foundation) — COMPLETE
**Activation:** Use /pi-everywhere (user's explicit preference over agentic-core)
**Next:** Phase 1 — Persistent Mint Knowledge Graph

This document is living. Update it after every major phase.
Last updated: 2026-07-12
