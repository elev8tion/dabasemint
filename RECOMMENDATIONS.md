# dabasemint — Vision Opportunities & Recommendations

**Status**: Strategic Plan completed + Final Polish applied (2026-07-08).

This document captures all opportunities that polish and enhance the core vision:

> A local-first, dark-neon visual masterpiece for /forge toolchests.  
> Sovereign ingestion → deep understanding → powerful composition → agent-augmented workflows → native desktop experience via Tauri + sidecars.

Everything stays on the user's machine. Toolchests are never copied or uploaded. Agents are accelerators, not the core.

---

## High-Impact Polish (Do Soon)

### 1. Sidecar Binary & Management (Partially Done)
- ✅ Added `build:sidecar` using `@yao-pkg/pkg`.
- ✅ `agent-proxy.mjs` as dedicated sidecar.
- **Next**:
  - Make sidecar output platform-specific binaries (`agent-proxy-macos`, etc.) and update `externalBin` + Rust spawning logic.
  - Add sidecar health monitoring (ping endpoint + auto-restart).
  - Write port to a temp file (`~/.dabasemint/agent-port.json`) so frontend can discover it reliably without invoke.
  - In Tauri, auto-kill sidecar on app quit.

### 2. Icons in Tauri Build Process (Done)
- ✅ `tauri:icons` script + inclusion in `tauri:build`.
- ✅ Source `src-tauri/icons/icon.svg` + generated set.

### 3. Native-First Experience in Tauri
- Use Tauri's `fs` and `dialog` more aggressively.
- When in Tauri, prefer `invoke('read_toolchest_native')` over browser File System Access API for reliability.
- Add "Open in Finder" / "Reveal in Explorer" buttons for registered toolchests.
- Store toolchest metadata + last-known paths in Tauri's app data dir (more reliable than localStorage).

### 4. Mint Flow — Turn Blueprints into Real Projects
- Current "Mint" creates an in-app entry.
- **Enhance**:
  - "Export as Real Project" button that scaffolds a folder:
    - `src/lib/` with copied/imported modules (with rewritten imports where possible).
    - `CONNECTION.md` generated or enhanced by agent.
    - `package.json` merge suggestions.
    - Basic `README.md` + `dabasemint.json` manifest.
  - Optional: Run a "scaffold" agent touchpoint that proposes folder structure.

### 5. Agent Proxy as First-Class Citizen
- Expose sidecar logs in the UI (live tail or recent errors).
- Add "Restart Agent Proxy" button.
- Support multiple agent providers with per-provider health.
- In Tauri, allow embedding the proxy logic in Rust later for zero-dependency builds.

---

## Medium-Term Enhancements (Vision Amplifiers)

### Visualization & Understanding (Phase 2)
- Richer interactive dependency graphs (use real contracts from `00-shared/contracts.md` when available).
- Per-module "Reusability Score" + "Blast Radius" (how many other modules depend on it).
- Timeline view of toolchest versions + drift visualization.
- "Similar Modules" finder across all registered toolchests.

### Composition Engine (Phase 3)
- Conflict detection beyond duplicates (e.g., conflicting contracts, version mismatches).
- Visual "wiring canvas" (connect modules with lines representing contracts).
- One-click "Create Starter Project" that also installs suggested dependencies.
- Blueprint templates / recipes ("Video Studio", "Agent UI", "CLI Tool").

### Agentic Layer (Phase 4)
- More touchpoints:
  - `suggest-refactors`
  - `generate-tests-for-module`
  - `explain-contracts`
  - `find-security-concerns`
- Persistent agent memory per toolchest or blueprint (stored locally).
- "Agent Workspace" mode: chat with context of current blueprint + selected toolchests.
- Export "Agent Kits" (curated context packs + instructions) that work in Pi / Cursor / Claude.

### Curation & Longevity (Phase 5)
- Smart collections (auto-group by tags, source type, contracts presence, last-used).
- Toolchest "Health Dashboard" (missing READMEs, outdated forge version, low contract coverage).
- Registry versioning + backup.
- "Sync" view that shows which modules have been used in minted projects.

### Polish, Extensibility & Polish (Phase 6)
- Full keyboard navigation + command palette (like Raycast / Linear).
- Theming system (beyond dark-neon — allow user CSS variables).
- Performance: virtualized lists for 100+ toolchests / thousands of modules.
- Error boundary + recovery UI (especially around FS and agent failures).
- Comprehensive test suite (Playwright for UI, vitest for logic).
- CLI parity: `dabasemint mint`, `dabasemint agent run`, `dabasemint registry export`.
- Auto-update support in Tauri.
- First-run onboarding wizard that loads the three reference toolchests + gives a tour.

---

## Strategic / Long-Term Opportunities

| Opportunity | Why it serves the vision | Effort | Impact |
|-------------|---------------------------|--------|--------|
| **Rust sidecar for agents** | Zero Node dependency in final Tauri build. Faster, smaller binary. | High | Very High |
| **MCP Server exposure** | Let Pi / other agents talk to dabasemint natively (query toolchests, run composition). | Medium | High |
| **Component extraction** | Turn high-quality modules into portable web components / npm packages. | Medium | High |
| **"Forge Live" mode** | Watch a folder and auto-refresh when new toolchests appear. | Low-Medium | Medium |
| **Collaboration stubs** | Export "shareable manifests" (no data, just references + notes). | Low | Medium |
| **Plugin system** | Allow community touchpoints / visualizers. | High | High |
| **Performance profiling** | Show memory/LOC estimates per toolchest and per module. | Low | Medium |
| **Beautiful exports** | PDF / HTML "Toolchest Catalog" reports with graphs and recommendations. | Medium | Medium-High |
| **Integration with other /forge tools** | Direct import from dissect / hardware-store outputs. | Medium | High |

---

## Recommended Immediate Next Steps (Prioritized)

1. **Sidecar binary + auto-start** (partially done — finish cross-platform + port file).
2. **"Export as Real Project"** scaffolding (highest user value after loading).
3. **Native Tauri FS commands** wired everywhere (remove browser FS dependency in Tauri builds).
4. **Command palette + better keyboard support**.
5. **Improved Mint + Context Pack** output (make the generated files actually useful).
6. **Health Dashboard** for the whole registry.
7. **Add 2–3 high-value new touchpoints** (e.g. `suggest-refactors`, `generate-tests`).
8. **Write real end-to-end tests** (Playwright + mocked toolchests).
9. **Generate & commit proper icons** (already done via `tauri icon`).
10. **Update `tauri.conf.json`** to properly reference built sidecar binaries per platform.

---

## Non-Goals (Protect the Vision)

- No cloud sync or accounts.
- No telemetry.
- No heavy frameworks (keep the vanilla + small Tauri core feeling fast and intentional).
- No "AI does everything" — agents assist, user stays in control.

---

**This document should be treated as living.** Update it whenever new opportunities are discovered during use of the three reference toolchests or new /forge outputs.

Run `npm run tauri:build` after the sidecar build script is stable to produce a real desktop experience.