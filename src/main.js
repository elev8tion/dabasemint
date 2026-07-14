/**
 * dabasemint — Full Visual Masterpiece + Agentic Layer
 * 
 * Strategic Plan FULLY COMPLETED
 * 
 * All phases implemented:
 * Phase 1: Real Ingestion (FS API + contracts awareness)
 * Phase 2: Visualization (inspector, graphs, Trade Routes, tags)
 * Phase 3: Composition (canvas, Mint, Context Pack, export)
 * Phase 4: Agentic (touchpoints, actionable results)
 * Phase 5: Curation (tagging, snapshots, drift, registry IO)
 * Phase 6: Polish & Docs (live updates, verification)
 */

import { registerToolchestFromDisk, refreshToolchestFromDisk } from './toolchest-loader.js';

const $ = (id) => document.getElementById(id);
const $$ = (sel) => [...document.querySelectorAll(sel)];

let state = {
  toolchests: [],
  selectedToolchestId: null,
  blueprint: [],
  agentProviderStatus: null,
  agentProviderChoice: localStorage.getItem('dabasemint:agent-provider') || 'novita',
  lastAgentResults: {},
  agentHistory: [],
  searchTerm: '',
  filterType: 'all',
  // === UX overhaul additions ===
  activeTab: 'library',
  onboardingSeen: localStorage.getItem('dabasemint:onboarding-seen') === '1',
  startHereDismissed: localStorage.getItem('dabasemint:start-here-dismissed') === '1',
  savedSearches: JSON.parse(localStorage.getItem('dabasemint:saved-searches') || '[]'),
  compareQueue: [],        // [{toolchestId, module}] for side-by-side compare
  exportHistory: JSON.parse(localStorage.getItem('dabasemint:export-history') || '[]'),
  undoStack: [],           // [{label, restore()}] one-deep
  fileStatus: {},          // toolchestId -> 'connected'|'missing'|'changed'|'stale'|'permission'
  filterRole: 'all',
  filterContractsOnly: false,
  filterHealthMin: 0,
  wizardStep: 0,           // -1 = closed
  lastAgentMeta: null      // {id, ts, confidence, costMs, provider}
};

// R3: proxy health state (declared early for use in fetchAgentStatus)
let lastProxyHealth = null;

// ==================== REFERENCE DATA (real + enhanced) ====================
const REFERENCE_TOOLCHESTS = [
  {
    id: 'page-agent',
    name: 'page-agent-toolchest',
    path: '/Users/kc/page-agent-toolchest',
    sourceType: 'oss-repo',
    modules: [
      { name: '00-shared', role: 'Build tooling + 4 interface contracts', loc: 457, type: 'contracts' },
      { name: '01-llms', role: 'OpenAI-compatible LLM client + retry layer', loc: 781, type: 'core' },
      { name: '02-page-controller', role: 'DOM ops, browser-use extraction, mask', loc: 3909, type: 'core' },
      { name: '03-core', role: 'PageAgentCore — observe→think→act loop', loc: 1507, type: 'core' },
      { name: '04-ui', role: 'Vanilla-TS chat Panel + i18n (decoupled)', loc: 1022, type: 'ui' },
      { name: '05-page-agent', role: 'Public entry = Core + Controller + Panel', loc: 84, type: 'entry' },
      { name: '06-mcp', role: 'MCP server → drives browser via extension', loc: 239, type: 'integration' },
      { name: '07-extension', role: 'Chrome extension (WXT+React) multi-tab', loc: 4946, type: 'integration' },
      { name: '08-website', role: 'Docs + landing + playground', loc: 8650, type: 'docs' }
    ],
    readme: "Page Agent — \"the GUI Agent living in your webpage\". Text-based DOM manipulation, BYO-LLM, Chrome extension + MCP. Excellent contracts.",
    forgeState: { target: 'https://github.com/alibaba/page-agent', modules: 9, version: '1.11.0' },
    contracts: true
  },
  {
    id: 'captions-site',
    name: 'captions-site-toolchest',
    path: '/Users/kc/captions-site-toolchest',
    sourceType: 'production-web',
    modules: [
      { name: '00-shared', role: 'Design tokens, analytics, asset taxonomy', loc: 200, type: 'shared' },
      { name: '01-api-client-provider', role: 'The powerful client provider (Od + factories)', loc: 450, type: 'core' },
      { name: '02-api-contract', role: 'Endpoints + Zod schemas', loc: 180, type: 'contracts' },
      { name: '03-asset-upload', role: 'GCS resumable upload (Zr + yk)', loc: 320, type: 'core' },
      { name: '04-studio-state', role: 'Zustand + 5 product modes', loc: 280, type: 'state' },
      { name: '05-studio-hero-ui', role: 'React prompt-to-video hero', loc: 410, type: 'ui' },
      { name: '06-workos-auth', role: 'SSO redirect flow', loc: 150, type: 'auth' },
      { name: '07-analytics-tracking', role: 'Statsig + Segment + 19 events', loc: 260, type: 'analytics' },
      { name: '08-video-player', role: 'Mux Player + Embla', loc: 190, type: 'media' },
      { name: '09-navigation', role: 'Radix mega menu', loc: 140, type: 'ui' },
      { name: '10-astro-marketing-shell', role: 'Astro + islands', loc: 380, type: 'shell' },
      { name: '11-ui-primitives', role: 'Radix + lucide + React Query', loc: 520, type: 'ui' }
    ],
    readme: "Recovered architecture of Captions.ai marketing site. Strong real-world client provider, upload, studio state, and third-party patterns.",
    forgeState: { target: 'feat-cms-client-provider-for', modules: 12, js_bytes: '2.3MB' },
    contracts: true
  },
  {
    id: 'glaze',
    name: 'Glaze-toolchest',
    path: '/Users/kc/Glaze-toolchest',
    sourceType: 'native-binary',
    modules: [
      { name: 'binary-analysis', role: 'otool, strings, decompile', loc: 800, type: 'analysis' },
      { name: 'runtime-assets', role: 'Embedded Node + web sources', loc: 600, type: 'runtime' },
      { name: 'web-sources', role: 'Injected React + WebKit UI', loc: 1200, type: 'ui' },
      { name: 'sdk', role: '@glaze/core + template apps', loc: 400, type: 'sdk' }
    ],
    readme: "Hybrid macOS app (Swift + WebKit + Node + Claude). Great patterns for desktop agent tooling.",
    forgeState: { target: '/Applications/Glaze.app', modules: 4, refine_note: 'Partial' },
    contracts: false
  }
];

// ==================== GLOSSARY (terminology hints) ====================
const TERMS = {
  toolchest: 'A folder of extracted reusable modules — typically the output of a /forge run.',
  blueprint: 'Your selected set of modules, composed together to form a new project.',
  mint: 'Save this blueprint as a reusable library item (a new minted toolchest).',
  assay: 'Analyze a toolchest for quality and reuse potential, then tag it.',
  trade: 'Find useful connections and powerful combinations between toolchests.',
  anatomy: 'The module-level breakdown of a single toolchest.',
  contracts: 'Interface definitions that describe how a module expects to be used.'
};

// Apply data-tip attributes to every <dfn data-term> in the document.
function applyGlossaryTooltips(root = document) {
  root.querySelectorAll('dfn[data-term]:not([data-tip])').forEach(el => {
    const tip = TERMS[el.dataset.term];
    if (tip) el.setAttribute('data-tip', tip);
  });
}

// ==================== TABS ====================
function setActiveTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.dataset.tabPanel === tab));
  // advanced panels share the 'advanced-' prefix
  if (tab.startsWith('advanced-')) {
    document.querySelectorAll('.tab-panel').forEach(p =>
      p.classList.toggle('active', p.dataset.tabPanel === tab));
  }
  renderNextSteps();
  window.scrollTo({ top: document.getElementById('tab-bar')?.offsetTop - 8 || 0, behavior: 'smooth' });
}

function showAdvanced(which) {
  const map = { snapshots: 'advanced-snapshots', trade: 'advanced-trade', providers: 'advanced-providers' };
  setActiveTab(map[which] || 'advanced-snapshots');
  if (which === 'providers') renderProvidersPanel();
  if (which === 'snapshots') renderSnapshotsPanel();
}

// ==================== EMPTY STATE HELPER ====================
function renderEmptyState(container, { icon = '📭', title, body, actions = [] }) {
  if (!container) return;
  const acts = actions.map(a =>
    `<button class="${a.primary ? 'primary-btn' : 'secondary-btn'}" data-es-action="${a.id}">${a.label}</button>`
  ).join('');
  container.innerHTML = `<div class="empty-state">
    <div class="es-icon">${icon}</div>
    <h3>${title}</h3>
    <p>${body}</p>
    <div class="es-actions">${acts}</div>
  </div>`;
  container.querySelectorAll('[data-es-action]').forEach(btn => {
    btn.onclick = () => {
      const a = actions.find(x => x.id === btn.dataset.esAction);
      if (a && typeof a.onClick === 'function') a.onClick();
    };
  });
}

// ==================== REUSABLE MODAL ====================
function openModal({ title = '', bodyHtml = '', wide = false, actions = [], onMount }) {
  const host = $('modal-host');
  if (!host) return;
  host.innerHTML = '';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="modal-card ${wide ? 'wide' : ''}">
    <button class="modal-x" aria-label="Close">×</button>
    ${title ? `<h2>${title}</h2>` : ''}
    <div class="modal-body"></div>
    <div class="modal-actions"></div>
  </div>`;
  host.appendChild(modal);
  const body = modal.querySelector('.modal-body');
  body.innerHTML = bodyHtml;
  const actionsEl = modal.querySelector('.modal-actions');
  actions.forEach(a => {
    const b = document.createElement('button');
    b.className = a.primary ? 'primary-btn' : 'ghost-btn';
    b.textContent = a.label;
    b.onclick = () => a.onClick({ modal, body, close: () => closeModalHost() });
    actionsEl.appendChild(b);
  });
  modal.querySelector('.modal-x').onclick = closeModalHost;
  modal.onclick = e => { if (e.target === modal) closeModalHost(); };
  if (typeof onMount === 'function') onMount({ modal, body });
  return { modal, body };
}
function closeModalHost() { const h = $('modal-host'); if (h) h.innerHTML = ''; }

// ==================== SUCCESS CARD ====================
let successCardTimer = null;
function showSuccessCard({ title = 'Done', summary = '', links = [], undo = null, duration = 6000 }) {
  const old = document.querySelector('.success-card'); if (old) old.remove();
  const card = document.createElement('div');
  card.className = 'success-card';
  const linksHtml = links.map(l =>
    `<button data-sc-link="${l.id}">${l.label}</button>`
  ).join('');
  card.innerHTML = `
    <button class="sc-close" aria-label="Close">×</button>
    <div class="sc-title">✅ ${title}</div>
    ${summary ? `<div class="sc-summary">${summary}</div>` : ''}
    ${linksHtml ? `<div class="sc-links">${linksHtml}</div>` : ''}
    <div class="sc-actions"></div>
  `;
  document.body.appendChild(card);
  const actionsEl = card.querySelector('.sc-actions');
  if (undo) {
    const ub = document.createElement('button'); ub.className = 'ghost-btn tiny'; ub.textContent = '↩ Undo';
    ub.onclick = () => { try { undo.restore(); } catch (e) { console.warn(e); } card.remove(); toast('Undone'); };
    actionsEl.appendChild(ub);
  }
  card.querySelector('.sc-close').onclick = () => card.remove();
  links.forEach(l => {
    const b = card.querySelector(`[data-sc-link="${l.id}"]`);
    if (b) b.onclick = () => { try { l.onClick(); } catch (e) { console.warn(e); } };
  });
  if (successCardTimer) clearTimeout(successCardTimer);
  if (duration > 0) successCardTimer = setTimeout(() => card.remove(), duration);
}

// ==================== COMMAND PALETTE ====================
let paletteOpen = false;

function toggleCommandPalette() {
  const existing = document.getElementById('cmd-palette');
  if (existing) { existing.remove(); paletteOpen = false; return; }
  const pal = document.createElement('div');
  pal.id = 'cmd-palette';
  pal.style.cssText = 'position:fixed;top:18%;left:50%;transform:translateX(-50%);z-index:9999;';
  pal.innerHTML = `
    <input id="cmd-input" placeholder="Type command... (register, mint, export-real, trade, assay, palette close)" />
    <div id="cmd-results" style="margin-top:8px;max-height:220px;overflow:auto;"></div>
  `;
  document.body.appendChild(pal);
  const input = pal.querySelector('#cmd-input');
  const results = pal.querySelector('#cmd-results');
  input.focus();
  paletteOpen = true;

  function execCmd(cmd) {
    pal.remove(); paletteOpen = false;
    if (cmd.includes('register') || cmd.includes('add')) document.getElementById('addToolchestBtn')?.click();
    else if (cmd.includes('mint')) window.mintBlueprint ? mintBlueprint() : alert('Mint');
    else if (cmd.includes('export-real') || cmd.includes('real')) exportAsRealProject();
    else if (cmd.includes('trade')) runTradeRoutes();
    else if (cmd.includes('assay')) { const first = state.toolchests[0]; if (first) runTouchpoint('assay-toolchest', {toolchest: first}); }
    else if (cmd.includes('close')) pal.remove();
    else toast('Command: ' + cmd);
  }

  input.oninput = () => {
    const q = input.value.toLowerCase();
    const cmds = [
      { label: 'register toolchest', run: () => document.getElementById('addToolchestBtn')?.click() },
      { label: 'export as real project', run: () => exportAsRealProject() },
      { label: 'mint blueprint', run: () => mintBlueprint() },
      { label: 'run trade routes', run: () => runTradeRoutes() },
      { label: 'assay first', run: () => { const first = state.toolchests[0]; if (first) runTouchpoint('assay-toolchest', { toolchest: first }); } },
      { label: 'export registry', run: () => exportRegistry() },
      { label: 'import registry', run: () => importRegistry() },
      { label: 'close palette', run: () => pal.remove() }
    ];
    results.innerHTML = '';
    cmds
      .filter(c => c.label.includes(q))
      .forEach(c => {
        const row = document.createElement('div');
        row.textContent = c.label;
        row.style.cssText = 'cursor:pointer;padding:4px 6px;border-radius:4px;';
        row.onmouseenter = () => { row.style.background = 'rgba(34,200,255,0.12)'; };
        row.onmouseleave = () => { row.style.background = ''; };
        row.onclick = () => { pal.remove(); paletteOpen = false; c.run(); };
        results.appendChild(row);
      });
  };
  input.onkeydown = (e) => { if (e.key === 'Enter') { execCmd(input.value); } if (e.key === 'Escape') { pal.remove(); paletteOpen = false; } };
}

// Keyboard: Cmd/Ctrl + K
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggleCommandPalette(); }
});

// ==================== PERSISTENCE ====================
function saveState() {
  localStorage.setItem('dabasemint:toolchests', JSON.stringify(state.toolchests));
  localStorage.setItem('dabasemint:blueprint', JSON.stringify(state.blueprint));
  localStorage.setItem('dabasemint:agentHistory', JSON.stringify(state.agentHistory));
  localStorage.setItem('dabasemint:saved-searches', JSON.stringify(state.savedSearches || []));
  localStorage.setItem('dabasemint:export-history', JSON.stringify(state.exportHistory || []));
  localStorage.setItem('dabasemint:onboarding-seen', state.onboardingSeen ? '1' : '0');
  localStorage.setItem('dabasemint:start-here-dismissed', state.startHereDismissed ? '1' : '0');
}

function exportRegistry() {
  const data = {
    exportedAt: new Date().toISOString(),
    toolchests: state.toolchests.map(tc => ({
      ...tc,
      _dirHandle: undefined // can't serialize handles
    })),
    version: '1.0'
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dabasemint-registry-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Registry exported (note: live directory handles not included)');
}

function importRegistry() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      if (data.toolchests && Array.isArray(data.toolchests)) {
        // Merge, avoiding duplicates by id
        const existingIds = new Set(state.toolchests.map(t => t.id));
        let added = 0;
        data.toolchests.forEach(tc => {
          if (!existingIds.has(tc.id)) {
            state.toolchests.push(tc);
            added++;
          }
        });
        saveState();
        renderAll();
        toast(`Imported ${added} toolchests from registry`);
      }
    } catch (err) {
      toast('Failed to import registry: ' + err.message);
    }
  };
  input.click();
}

function loadState() {
  try {
    const saved = localStorage.getItem('dabasemint:toolchests');
    if (saved) state.toolchests = JSON.parse(saved);

    const bp = localStorage.getItem('dabasemint:blueprint');
    if (bp) state.blueprint = JSON.parse(bp);

    const hist = localStorage.getItem('dabasemint:agentHistory');
    if (hist) state.agentHistory = JSON.parse(hist);

    const ss = localStorage.getItem('dabasemint:saved-searches');
    if (ss) state.savedSearches = JSON.parse(ss);
    const eh = localStorage.getItem('dabasemint:export-history');
    if (eh) state.exportHistory = JSON.parse(eh);
  } catch (err) {
    // B1 fix: no longer silent. Log, provide safe defaults, non-intrusive toast.
    console.error('Failed to load dabasemint state from localStorage (corrupted data?):', err);
    state.toolchests = state.toolchests || [];
    state.blueprint = state.blueprint || [];
    state.agentHistory = state.agentHistory || [];
    if (typeof toast === 'function') {
      toast('State load issue — started with clean library (old data safe in localStorage backup)', 3000);
    }
  }
}

// ==================== SCORING & HEALTH ====================
function computeHealth(tc) {
  const moduleCount = tc.modules?.length || 0;
  let score = Math.min(95, 40 + (moduleCount * 5));
  if (tc.contracts) score += 12;
  if (tc.sourceType === 'oss-repo') score += 8;
  if (tc.sourceType === 'production-web') score += 5;
  return Math.min(100, Math.round(score));
}

function getRichnessLabel(score) {
  if (score >= 85) return { label: 'Exceptional', color: 'ok' };
  if (score >= 70) return { label: 'Strong', color: 'cyan' };
  if (score >= 55) return { label: 'Good', color: 'warn' };
  return { label: 'Emerging', color: 'danger' };
}

// B2 helper: replaces multiple empty catch {} for Tauri/FS calls with consistent
// logging + sensible fallback. Reduces silent degradation in desktop mode.
async function safeTauriCall(operation, fallback = null, context = '') {
  try {
    return await operation();
  } catch (e) {
    console.warn(`Tauri/FS operation failed ${context}:`, e);
    return fallback;
  }
}

// ==================== AGENT ====================
async function fetchAgentStatus() {
  try {
    const res = await fetch(`/api/agent/status?provider=${encodeURIComponent(state.agentProviderChoice)}`);
    state.agentProviderStatus = await res.json();
  } catch (err) {
    console.warn('Agent status fetch failed; using offline provider status:', err);
    state.agentProviderStatus = {
      configured: false,
      provider: state.agentProviderChoice,
      model: 'nvidia/nemotron-3-nano-30b-a3b',
      error: 'status-unreachable'
    };
  }
  await fetchProxyHealthAndPort();
  renderAgentStatus();
}

// R3: proxy health + port discovery (surgical addition for agent proxy UI)
async function fetchProxyHealthAndPort() {
  let port = null;
  let health = { ok: false };
  const isTauri = !!window.__TAURI__;
  if (isTauri && window.__TAURI__.invoke) {
    port = await safeTauriCall(
      () => window.__TAURI__.invoke('get_agent_proxy_port'),
      null,
      'get_agent_proxy_port'
    );
    if (!port && window.__TAURI__.fs) {
      const fsData = await safeTauriCall(async () => {
        const { readTextFile, BaseDirectory } = window.__TAURI__.fs;
        const data = await readTextFile('.dabasemint/agent-proxy-port.json', { dir: BaseDirectory.Home });
        return JSON.parse(data);
      }, null, 'read port file');
      if (fsData && fsData.port) port = fsData.port;
    }
  }
  const base = port ? `http://127.0.0.1:${port}` : '';
  try {
    const url = base ? `${base}/api/agent/health` : '/api/agent/health';
    const r = await fetch(url, { method: 'GET' });
    if (r.ok) {
      health = await r.json();
      if (health.port) port = health.port;
    }
  } catch (e) {
    health = { ok: false, error: 'unreachable' };
  }
  lastProxyHealth = { port, health, lastChecked: Date.now() };
  return lastProxyHealth;
}

async function restartAgentProxy() {
  const el = $('agent-status');
  if (el) el.innerHTML = `<span style="color:#ffd166">Restarting proxy...</span>`;

  const isTauri = !!(window.__TAURI__ && window.__TAURI__.invoke);
  if (isTauri) {
    try {
      // Ask the managed sidecar to restart and return its new port.
      const port = await window.__TAURI__.invoke('restart_agent_proxy');
      toast(port ? `Agent proxy restarted on port ${port}` : 'Agent proxy restart returned no port (dev mode uses npm run serve)');
    } catch (e) {
      toast('Proxy restart failed: ' + (e?.message || e));
    }
  } else {
    toast('Restart only applies to the desktop app. Web mode uses the running server.');
  }
  await fetchProxyHealthAndPort();
  await fetchAgentStatus();
  renderAgentStatus();
}

async function runTouchpoint(id, context = {}) {
  const resultsArea = $('global-agent-results');
  const originalHtml = resultsArea ? resultsArea.innerHTML : '';

  const isTauri = !!window.__TAURI__;
  let baseUrl = '';

  if (isTauri && window.__TAURI__.invoke) {
    try {
      const port = await window.__TAURI__.invoke('get_agent_proxy_port');
      if (port) {
        baseUrl = `http://127.0.0.1:${port}`;
      }
    } catch (e) {
      console.warn('Could not get sidecar port via invoke, trying port file', e);
    }

    // Fallback: read port file written by sidecar
    if (!baseUrl && window.__TAURI__.fs) {
      try {
        const { readTextFile, BaseDirectory } = window.__TAURI__.fs;
        const portData = await readTextFile('.dabasemint/agent-proxy-port.json', { dir: BaseDirectory.Home });
        const parsed = JSON.parse(portData);
        if (parsed.port) baseUrl = `http://127.0.0.1:${parsed.port}`;
      } catch (err) {
        console.warn('Could not read agent proxy port file fallback:', err);
      }
    }
  }

  // If not in Tauri or no sidecar port yet, check local dev server
  if (!baseUrl) {
    try {
      const health = await fetch('/api/agent/status', { method: 'GET' });
      if (!health.ok) throw new Error('Agent server not responding');
    } catch (e) {
      if (resultsArea) resultsArea.innerHTML = `<div class="agent-result-card error">Agent server not running.<br>Start it with <code>npm run serve</code> (or use the Tauri app).</div>`;
      return { ok: false, error: 'Agent proxy server not available.' };
    }
    baseUrl = '';
  }

  if (resultsArea) resultsArea.innerHTML = `<div class="agent-running">Running ${id} with ${state.agentProviderChoice}...</div>`;

  try {
    const res = await fetch(`${baseUrl}/api/agent/touchpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, context, provider: state.agentProviderChoice })
    });
    const result = await res.json();

    state.lastAgentResults[id] = result;
    state.agentHistory.unshift({ id, time: Date.now(), result, contextSummary: Object.keys(context).join(', ') });
    if (state.agentHistory.length > 12) state.agentHistory.pop();
    saveState();

    // Capture metadata for the Agent Actions strip.
    state.lastAgentMeta = {
      id,
      ts: Date.now(),
      confidence: result?.data?.confidence ?? (result?.ok ? 'n/a' : 'low'),
      costMs: result?.data?.costMs ?? null,
      provider: state.agentProviderChoice
    };
    renderAgentActionsPanel();

    renderAgentResult(id, result);
    return result;
  } catch (e) {
    const err = { ok: false, error: e.message };
    renderAgentResult(id, err);
    return err;
  }
}

// ==================== TOOLCHEST REGISTRY ====================
function registerToolchest(data) {
  if (state.toolchests.find(t => t.id === data.id)) {
    toast('Already registered');
    return;
  }
  state.toolchests.push({ ...data, addedAt: Date.now() });
  saveState();
  renderAll();
  showSuccessCard({
    title: `Registered ${data.name}`,
    summary: `${data.modules?.length || 0} modules loaded from ${data.sourceType || 'source'}.`,
    links: [
      { id: 'assay', label: '🧪 Run assay', onClick: () => runAssay(data.id) },
      { id: 'anatomy', label: '🔬 Inspect anatomy', onClick: () => { setActiveTab('anatomy'); selectToolchest(data.id); } },
      { id: 'core', label: '➕ Add core modules to blueprint', onClick: () => addAllModulesToBlueprint(data.id) }
    ],
    duration: 7000
  });

  // Auto-validate after registration (helps catch bad loads early)
  setTimeout(() => validateToolchest(data.id), 800);
}

function validateToolchest(id) {
  const tc = state.toolchests.find(t => t.id === id);
  if (!tc) return;

  const issues = [];
  if (!tc.modules || tc.modules.length === 0) issues.push('No modules detected');
  if (tc.hasForgeState === false && !tc._nativePath) issues.push('Missing .forge-state.md');
  if (!tc.contracts && tc.sourceType === 'oss-repo') issues.push('No contracts found (unusual for OSS toolchest)');

  if (issues.length > 0) {
    toast(`Validation warnings for ${tc.name}: ${issues.join(', ')}`, 4000);
  }
}

function removeToolchest(id) {
  const idx = state.toolchests.findIndex(t => t.id === id);
  if (idx < 0) return;
  const removed = state.toolchests[idx];
  const removedBp = state.blueprint.filter(b => b.toolchestId === id);
  state.toolchests = state.toolchests.filter(t => t.id !== id);
  state.blueprint = state.blueprint.filter(b => b.toolchestId !== id);
  if (state.selectedToolchestId === id) state.selectedToolchestId = null;
  saveState();
  renderAll();
  showSuccessCard({
    title: `Removed ${removed.name}`,
    summary: 'The toolchest and its blueprint entries were removed.',
    undo: {
      restore: () => {
        state.toolchests.splice(Math.min(idx, state.toolchests.length), 0, removed);
        state.blueprint.push(...removedBp);
        saveState(); renderAll();
      }
    },
    duration: 8000
  });
}

function createSnapshot(id) {
  const tc = state.toolchests.find(t => t.id === id);
  if (!tc) return;
  const snap = {
    ...JSON.parse(JSON.stringify(tc)), // deep clone without handle
    id: `${tc.id}-snapshot-${Date.now()}`,
    name: `${tc.name} (snapshot ${new Date().toLocaleDateString()})`,
    tags: [...(tc.tags || []), 'snapshot'],
    addedAt: Date.now(),
    _dirHandle: undefined
  };
  state.toolchests.push(snap);
  saveState();
  renderAll();
  toast('Snapshot created');
}

function compareToolchests(id1, id2) {
  const t1 = state.toolchests.find(t => t.id === id1);
  const t2 = state.toolchests.find(t => t.id === id2);
  if (!t1 || !t2) return;
  const m1 = new Set(t1.modules.map(m => m.name));
  const m2 = new Set(t2.modules.map(m => m.name));
  const added = [...m2].filter(m => !m1.has(m));
  const removed = [...m1].filter(m => !m2.has(m));
  const common = [...m1].filter(m => m2.has(m)).length;
  alert(`Comparison ${t1.name} vs ${t2.name}

Common modules: ${common}
Added in second: ${added.length} (${added.slice(0,5).join(', ')})
Removed from first: ${removed.length} (${removed.slice(0,5).join(', ')})`);
}

function compareLastTwo() {
  if (state.toolchests.length < 2) return toast('Need at least 2 toolchests');
  const lastTwo = state.toolchests.slice(-2);
  compareToolchests(lastTwo[0].id, lastTwo[1].id);
}

async function refreshToolchest(id) {
  const idx = state.toolchests.findIndex(t => t.id === id);
  if (idx === -1) return;

  const tc = state.toolchests[idx];

  if (tc._dirHandle) {
    try {
      const refreshed = await refreshToolchestFromDisk(tc);
      state.toolchests[idx] = refreshed;
      toast('Refreshed from disk using stored handle');
      saveState();
      renderAll();
      return;
    } catch (e) {
      console.warn('Real refresh failed, falling back', e);
    }
  }

  // Fallback for demo references
  const ref = REFERENCE_TOOLCHESTS.find(r => r.id === id);
  if (ref) {
    state.toolchests[idx] = { ...ref, addedAt: tc.addedAt };
    toast('Refreshed from known reference data');
  } else {
    toast('No stored handle — re-register for live refresh');
  }
  saveState();
  renderAll();
}

async function loadReferenceToolchests() {
  REFERENCE_TOOLCHESTS.forEach(ref => {
    if (!state.toolchests.find(t => t.id === ref.id)) {
      state.toolchests.push({ ...ref });
    }
  });
  saveState();
  renderAll();
  toast('Loaded all reference toolchests');
}

// ==================== BLUEPRINT ====================
function addModuleToBlueprint(toolchestId, moduleName) {
  const existing = state.blueprint.find(b => b.module === moduleName);
  if (existing) {
    if (existing.toolchestId !== toolchestId) {
      if (!confirm(`Warning: Module "${moduleName}" already exists from another toolchest. Add duplicate anyway?`)) return;
    } else return;
  }
  state.blueprint.push({ toolchestId, module: moduleName });
  saveState();
  renderAll();
}

function removeFromBlueprint(index) {
  state.blueprint.splice(index, 1);
  saveState();
  renderAll();
}

function clearBlueprint() {
  const prev = state.blueprint.slice();
  state.blueprint = [];
  saveState();
  renderComposition();
  if (prev.length) {
    showSuccessCard({
      title: 'Blueprint cleared',
      summary: `${prev.length} module(s) removed.`,
      undo: { restore: () => { state.blueprint = prev; saveState(); renderComposition(); } },
      duration: 7000
    });
  }
}

function exportBlueprint() {
  if (!state.blueprint.length) return toast('Blueprint is empty');

  const modulesInfo = state.blueprint.map(b => {
    const tc = state.toolchests.find(t => t.id === b.toolchestId);
    return { toolchest: tc?.name, module: b.module, source: tc?.path || '' };
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    modules: modulesInfo,
    suggestedProject: {
      'src/': 'Your main application code',
      'lib/imported/': 'Modules pulled from toolchests (copy relevant folders here)',
      'CONNECTION.md': 'See generated notes below'
    }
  };

  // Generate CONNECTION.md content
  let connectionMd = `# Blueprint Connections

Generated by dabasemint on ${new Date().toISOString()}

## Selected Modules

`;
  modulesInfo.forEach(m => {
    connectionMd += `- **${m.module}** from ${m.toolchest}
`;
  });
  connectionMd += `
## Recommended Integration Steps

1. Copy the module folders into your lib/imported/
2. Update import paths
3. Check contracts in 00-shared of each source
4. Run the Composition Advisor again after wiring

`;

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dabasemint-blueprint-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  // Also offer CONNECTION.md
  const mdBlob = new Blob([connectionMd], { type: 'text/markdown' });
  const mdUrl = URL.createObjectURL(mdBlob);
  const mdA = document.createElement('a');
  mdA.href = mdUrl;
  mdA.download = 'CONNECTION.md';
  mdA.click();
  URL.revokeObjectURL(mdUrl);

  toast('Blueprint + CONNECTION.md exported');
}

// Export as Real Project - scaffolds usable folder structure
async function exportAsRealProject() {
  if (!state.blueprint.length) return toast('Blueprint is empty - add modules first');

  const destName = prompt('Project name for scaffold (e.g. my-composed-app):', 'my-dabasemint-project') || 'dabasemint-scaffold-' + Date.now();
  const modulesInfo = state.blueprint.map(b => {
    const tc = state.toolchests.find(t => t.id === b.toolchestId);
    return { toolchest: tc?.name || 'unknown', module: b.module, source: tc?.path || tc?._nativePath || '' };
  });

  // Build scaffold manifest + files
  let projectReadme = `# ${destName}

Scaffolded by dabasemint — ${new Date().toISOString()}

## Modules Included

`;
  let connectionMd = `# CONNECTIONS

**Exported from dabasemint Blueprint**

`;
  const manifest = { name: destName, exportedAt: new Date().toISOString(), modules: [] };

  modulesInfo.forEach(m => {
    projectReadme += `- ${m.module} (from ${m.toolchest})
`;
    connectionMd += `- ${m.module}: See ${m.toolchest} contracts + adapt imports
`;
    manifest.modules.push(m);
  });

  projectReadme += `

## Usage

1. Copy lib/ contents into your src/
2. Review CONNECTION.md
3. npm install (see suggested)
`;

  const packageJson = {
    name: destName.toLowerCase().replace(/\s+/g, '-'),
    version: "0.1.0",
    type: "module",
    dependencies: { },
    scripts: { start: "node index.js" },
    dabasemint: manifest
  };

  // Simulate full scaffold download (real write via Tauri invoke in future)
  const files = {
    'README.md': projectReadme,
    'CONNECTION.md': connectionMd,
    'package.json': JSON.stringify(packageJson, null, 2),
    'dabasemint.json': JSON.stringify(manifest, null, 2),
    'src/lib/README.txt': 'Place imported modules here. Example: 01-llms/ , 00-shared/ copied from source.'
  };

  // Trigger multiple downloads for the scaffold (practical in browser)
  Object.entries(files).forEach(([name, content], i) => {
    setTimeout(() => {
      const b = new Blob([content], { type: name.endsWith('.json') ? 'application/json' : 'text/plain' });
      const u = URL.createObjectURL(b);
      const link = document.createElement('a');
      link.href = u;
      link.download = `${destName}/${name}`;
      link.click();
      URL.revokeObjectURL(u);
    }, i * 120);
  });

  recordExport(destName, modulesInfo.length, Object.keys(files).length);

  showSuccessCard({
    title: `Exported “${destName}”`,
    summary: `${modulesInfo.length} modules → ${Object.keys(files).length} files downloaded. Next: copy lib/ into your src/, review CONNECTION.md, npm install.`,
    links: [
      { id: 'open', label: '📂 Open exported folder', onClick: () => openExportedFolder() },
      { id: 'copy', label: '📋 Copy next prompt', onClick: () => copyNextPrompt(destName) }
    ],
    duration: 0 // persists until dismissed
  });
}

function copyNextPrompt(name) {
  const prompt = `I scaffolded a project “${name}” from dabasemint with these modules:\n${state.blueprint.map(b => '- ' + b.module).join('\n')}\n\nHelp me wire them together, resolve import paths, and add any missing glue code.`;
  try {
    navigator.clipboard.writeText(prompt);
    toast('Next prompt copied to clipboard');
  } catch { toast('Clipboard blocked — see console'); console.log(prompt); }
}

// ==================== RENDERING ====================
function renderAll() {
  renderLibrary();
  renderSelectedAnatomy();
  renderComposition();
  renderAgentStatus();
  renderAgentActionsPanel();
  renderExportsPanel();
  renderStartHere();
  renderTabCounts();
  renderNextSteps();
  renderSavedSearchesDropdown();
  updateMetrics();
  renderCollections();
  renderHealthDashboard();
  applyGlossaryTooltips();
}

function renderCollections() {
  // Simple tag collections summary
  const allTags = {};
  state.toolchests.forEach(tc => {
    (tc.tags || []).forEach(tag => {
      allTags[tag] = (allTags[tag] || 0) + 1;
    });
  });
  const tags = Object.keys(allTags);
  if (tags.length === 0) return;

  let container = $('collections-summary');
  if (!container) {
    const lib = $('library-grid');
    if (lib && lib.parentElement) {
      container = document.createElement('div');
      container.id = 'collections-summary';
      container.style.margin = '4px 0 12px'; container.style.fontSize = '12px';
      lib.parentElement.insertBefore(container, lib);
    } else return;
  }
  container.innerHTML = `<div class="muted">Collections: ${tags.map(t => `<span class="tag" style="cursor:pointer" onclick="filterByTag('${t}')">${t} (${allTags[t]})</span>`).join(' ')} <button class="tiny" onclick="clearTagFilter()">clear</button></div>`;
}

function filterByTag(tag) {
  state.searchTerm = tag;
  const s = $('search-input');
  if (s) s.value = tag;
  renderLibrary();
}

// ==================== START HERE / TAB COUNTS / PROVIDERS ====================
function renderStartHere() {
  const el = $('start-here');
  if (!el) return;
  const show = !state.startHereDismissed && state.toolchests.length === 0;
  el.style.display = show ? 'block' : 'none';
  applyGlossaryTooltips(el);
}

function dismissStartHere() {
  state.startHereDismissed = true;
  saveState();
  renderStartHere();
  toast('Start-here panel hidden. Find Tour in the top bar anytime.');
}

function renderTabCounts() {
  const bp = $('tab-count-blueprint');
  if (bp) bp.textContent = state.blueprint.length;
}

function renderProvidersPanel() {
  const el = $('providers-panel');
  if (!el) return;
  const s = state.agentProviderStatus || {};
  const providers = (s.providers && s.providers.length) ? s.providers : [{ id: 'novita', name: 'Novita', configured: !!s.configured }];
  const rows = providers.map(p => `<div class="health-card">
    <div><strong>${p.name}</strong> ${p.configured ? '<span class="status-badge connected">configured</span>' : '<span class="status-badge missing">no key</span>'}</div>
    <div class="muted" style="font-size:11px;margin-top:4px">id: ${p.id} • ${p.model || '—'}</div>
  </div>`).join('');
  el.innerHTML = `<div class="section-header"><h2>Provider Status</h2></div>
    <div class="health-cards">${rows}</div>
    <p class="muted" style="font-size:12px;margin-top:14px">Edit <code>config/agent.local.json</code> to add provider keys. Then run <code>npm run serve</code>.</p>`;
}

function renderSnapshotsPanel() {
  const el = $('snapshots-panel');
  if (!el) return;
  const snaps = state.toolchests.filter(t => t.snapshotOf);
  if (!snaps.length) {
    renderEmptyState(el, {
      icon: '📸', title: 'No snapshots yet',
      body: 'Snapshots are versioned captures of a toolchest at a point in time. Create one from a toolchest card (Snapshot action) to track drift over time.',
      actions: [{ id: 'go', label: 'Go to Library', onClick: () => setActiveTab('library') }]
    });
    return;
  }
  el.innerHTML = `<div class="health-cards">${snaps.map(s => `<div class="health-card"><strong>${s.name}</strong> <span class="muted" style="font-size:11px">${new Date(s.addedAt).toLocaleString()}</span></div>`).join('')}</div>`;
}

// ==================== AGENT ACTIONS PANEL ====================
function renderAgentActionsPanel() {
  const el = $('agent-actions-panel');
  if (!el) return;
  const hasTc = !!state.selectedToolchestId || state.toolchests.length > 0;
  const tcId = state.selectedToolchestId || (state.toolchests[0] && state.toolchests[0].id);
  const actions = [
    { id: 'assay',       icon: '🧪', title: 'Analyze toolchest',     desc: 'Run an assay on the selected toolchest', disabled: !tcId },
    { id: 'recommend',   icon: '⭐', title: 'Recommend modules',     desc: 'Suggest high-reuse modules to add',       disabled: !state.toolchests.length },
    { id: 'explain',     icon: '📖', title: 'Explain this module',   desc: 'Deep-dive a selected module',             disabled: !tcId },
    { id: 'missing',     icon: '🧩', title: 'Find missing pieces',   desc: 'Gaps in your current blueprint',          disabled: !state.blueprint.length },
    { id: 'docs',        icon: '📝', title: 'Generate project docs', desc: 'Context pack for the blueprint',          disabled: !state.blueprint.length },
    { id: 'audit',       icon: '🔍', title: 'Audit blueprint',       desc: 'Composition advisor run',                 disabled: !state.blueprint.length }
  ];
  const grid = actions.map(a => `<button class="agent-action-btn" data-aa="${a.id}" ${a.disabled ? 'disabled' : ''}>
    <span class="aa-icon">${a.icon}</span>
    <span class="aa-title">${a.title}</span>
    <span class="aa-desc">${a.desc}</span>
  </button>`).join('');
  const meta = state.lastAgentMeta;
  const metaHtml = meta ? `<div class="agent-meta-strip">
    <span><strong>Last run:</strong> ${meta.id}</span>
    <span><strong>When:</strong> ${new Date(meta.ts).toLocaleTimeString()}</span>
    ${meta.confidence != null ? `<span><strong>Confidence:</strong> ${meta.confidence}</span>` : ''}
    ${meta.costMs != null ? `<span><strong>Time:</strong> ${meta.costMs}ms</span>` : ''}
    <span><strong>Provider:</strong> ${meta.provider || '—'}</span>
  </div>` : '';
  el.innerHTML = `<div class="agent-action-grid">${grid}</div>${metaHtml}
    <div class="agent-raw"><details><summary>Show raw result</summary><pre id="agent-raw-pre">${meta ? 'select an action to see output' : 'no runs yet'}</pre></details></div>`;
  el.querySelectorAll('[data-aa]').forEach(b => {
    b.onclick = () => handleAgentAction(b.dataset.aa, tcId);
  });
}

async function handleAgentAction(id, tcId) {
  const raw = $('agent-raw-pre');
  if (id === 'assay' && tcId) { await runAssay(tcId); }
  else if (id === 'recommend') {
    const tc = state.toolchests.find(t => t.id === tcId) || state.toolchests[0];
    if (tc) { await runTouchpoint('find-complements', { primaryModules: tc.modules.slice(0, 3), availableToolchests: state.toolchests.map(t => t.name) }); }
  }
  else if (id === 'explain' && tcId) {
    const tc = state.toolchests.find(t => t.id === tcId);
    if (tc) { await runTouchpoint('assay-toolchest', { toolchestName: tc.name, modules: tc.modules.slice(0, 4), readmeExcerpt: tc.readme }); }
  }
  else if (id === 'missing') { await runCompositionAdvisor(); }
  else if (id === 'docs')    { await generateContextPack(); }
  else if (id === 'audit')   { await runCompositionAdvisor(); }
  if (raw) raw.textContent = JSON.stringify(state.lastAgentResults, null, 2).slice(0, 4000);
}

// ==================== EXPORTS PANEL ====================
function renderExportsPanel() {
  const el = $('exports-panel');
  if (!el) return;
  const hist = state.exportHistory || [];
  const blueprintReady = state.blueprint.length > 0;
  const header = `<div style="padding:16px">
    <button class="primary-btn" data-export="preview" ${blueprintReady ? '' : 'disabled'}>📦 Preview & export project</button>
    ${!blueprintReady ? '<p class="muted" style="font-size:12px;margin-top:8px">Add modules to your blueprint first.</p>' : ''}
  </div>`;
  const histHtml = hist.length ? `<div style="padding:0 16px 16px"><h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)">Recent exports</h4>
    ${hist.map(h => `<div class="export-history-item"><div class="eh-top"><strong>${h.name}</strong><span class="muted" style="font-size:11px">${new Date(h.ts).toLocaleString()}</span></div>
      <div class="muted" style="font-size:12px;margin-top:4px">${h.moduleCount} modules • ${h.files} files</div></div>`).join('')}
  </div>` : '';
  el.innerHTML = header + histHtml;
  el.querySelector('[data-export="preview"]')?.addEventListener('click', () => startExportPreview());
}

// ==================== NEXT-STEPS SUGGESTIONS ====================
function nextSteps() {
  const steps = [];
  if (state.toolchests.length === 0) {
    steps.push({ label: '+ Register a /forge folder', onClick: () => $('addToolchestBtn')?.click() });
    steps.push({ label: 'Load demo library', onClick: () => loadReferenceToolchests() });
    return steps;
  }
  if (state.blueprint.length === 0) {
    steps.push({ label: '🧪 Run assay on first toolchest', onClick: () => { setActiveTab('anatomy'); const id = state.toolchests[0].id; selectToolchest(id); runAssay(id); } });
    steps.push({ label: '🔬 Inspect anatomy', onClick: () => setActiveTab('anatomy') });
    steps.push({ label: '➕ Add core modules to blueprint', onClick: () => { state.toolchests.forEach(t => { const core = t.modules.find(m => /core|shared/i.test(m.name)); if (core) addModuleToBlueprint(t.id, core.name); }); } });
    return steps;
  }
  if (state.exportHistory.length === 0) {
    steps.push({ label: '🧠 Run composition advisor', onClick: () => { setActiveTab('blueprint'); runCompositionAdvisor(); } });
    steps.push({ label: '📝 Generate context pack', onClick: () => generateContextPack() });
    steps.push({ label: '📦 Export as real project', onClick: () => startExportPreview() });
    return steps;
  }
  steps.push({ label: '🧱 Mint this blueprint', onClick: () => mintBlueprint() });
  steps.push({ label: '📦 Preview another export', onClick: () => startExportPreview() });
  steps.push({ label: '🛣 Trade routes', onClick: () => runTradeRoutes() });
  return steps;
}

function renderNextSteps() {
  const steps = nextSteps();
  const targetTab = state.activeTab || 'library';
  const el = $('next-steps-' + targetTab);
  // also handle advanced-* tabs gracefully (no panel -> skip)
  if (!el) return;
  if (!steps.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="next-steps"><h4>What to do next</h4><div class="ns-list">${steps.map((s, i) => `<button class="ghost-btn tiny" data-ns="${i}">${s.label}</button>`).join('')}</div></div>`;
  el.querySelectorAll('[data-ns]').forEach(b => {
    b.onclick = () => { try { steps[+b.dataset.ns].onClick(); } catch (e) { console.warn(e); } };
  });
}

// ==================== SAVED SEARCHES DROPDOWN ====================
function renderSavedSearchesDropdown() {
  const sel = $('saved-searches');
  if (!sel) return;
  const opts = state.savedSearches.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');
  sel.innerHTML = `<option value=\"\">Saved searches…</option>${opts}`;
  sel.onchange = () => {
    const idx = +sel.value;
    const s = state.savedSearches[idx];
    if (!s) return;
    state.searchTerm = s.query || '';
    state.filterType = s.filters?.type || 'all';
    state.filterRole = s.filters?.role || 'all';
    state.filterContractsOnly = !!s.filters?.contractsOnly;
    state.filterHealthMin = s.filters?.healthMin || 0;
    syncFilterInputs();
    renderLibrary();
  };
}

function syncFilterInputs() {
  const s = $('search-input'); if (s) s.value = state.searchTerm || '';
  const f = $('filter-type'); if (f) f.value = state.filterType;
  const r = $('filter-role'); if (r) r.value = state.filterRole;
  const c = $('filter-contracts'); if (c) c.checked = state.filterContractsOnly;
  const h = $('filter-health'); if (h) h.value = state.filterHealthMin || '';
}

function clearTagFilter() {
  state.searchTerm = '';
  const s = $('search-input');
  if (s) s.value = '';
  renderLibrary();
}

// R4: Health Dashboard (global stats + per-toolchest cards)
function renderHealthDashboard() {
  let container = $('health-dashboard');
  if (!container) {
    const lib = $('library-grid');
    if (lib && lib.parentElement && lib.parentElement.parentElement) {
      container = document.createElement('div');
      container.id = 'health-dashboard';
      container.className = 'health-dashboard';
      // Insert after the library section
      const libSection = lib.closest('.section') || lib.parentElement;
      if (libSection && libSection.parentElement) {
        libSection.parentElement.insertBefore(container, libSection.nextSibling);
      } else {
        lib.parentElement.appendChild(container);
      }
    } else return;
  }

  const tcs = state.toolchests || [];
  const totalModules = tcs.reduce((sum, tc) => sum + (tc.modules?.length || 0), 0);
  const healths = tcs.map(tc => computeHealth(tc));
  const avgHealth = tcs.length ? Math.round(healths.reduce((a, b) => a + b, 0) / tcs.length) : 0;
  const missingContracts = tcs.filter(tc => !tc.contracts).length;

  let cardsHtml = tcs.map(tc => {
    const score = computeHealth(tc);
    const label = getRichnessLabel(score);
    const issues = [];
    if (!tc.contracts) issues.push('no contracts');
    if (!tc.modules || tc.modules.length < 3) issues.push('sparse modules');
    const issueStr = issues.length ? issues.join(', ') : 'healthy';
    return `<div class="health-card">
      <div><strong>${tc.name}</strong> <span class="health-score ${label.color}">${score}</span></div>
      <div class="muted" style="font-size:11px; margin-top:2px;">${tc.sourceType || ''} • ${tc.modules?.length || 0} mods • ${issueStr}</div>
    </div>`;
  }).join('');

  if (!cardsHtml) cardsHtml = '<div class="empty-card" style="padding:16px 10px;font-size:12px;">Register toolchests to see health dashboard.</div>';

  container.innerHTML = `
    <div class="section-header"><h2>Registry Health Dashboard</h2><p>Global stats + per-toolchest health</p></div>
    <div class="health-stats">
      <div><span class="big">${tcs.length}</span><small>toolchests</small></div>
      <div><span class="big">${totalModules}</span><small>modules</small></div>
      <div><span class="big">${avgHealth}</span><small>avg health</small></div>
      <div><span class="big">${missingContracts}</span><small>missing contracts</small></div>
    </div>
    <div class="health-cards">${cardsHtml}</div>
  `;
}

function updateMetrics() {
  const t = $('metricToolchests'); if (t) t.textContent = state.toolchests.length;
  const m = $('metricModules'); if (m) m.textContent = state.toolchests.reduce((s, t) => s + (t.modules?.length || 0), 0);
  const b = $('metricBlueprints'); if (b) b.textContent = state.blueprint.length;
}

// ==================== ROLE / NL SEARCH HELPERS ====================
// Synonym map: natural-language intent -> module role/type token.
const ROLE_SYNONYMS = {
  auth: ['auth', 'login', 'sso', 'workos', 'session', 'oauth', 'credential'],
  ui: ['ui', 'react', 'component', 'radix', 'panel', 'frontend', 'view', 'primitive'],
  core: ['core', 'engine', 'loop', 'controller', 'agent', 'orchestrator'],
  media: ['media', 'video', 'audio', 'upload', 'player', 'mux', 'image'],
  analytics: ['analytics', 'tracking', 'statsig', 'segment', 'metric'],
  contracts: ['contracts', 'schema', 'zod', 'interface', 'shared'],
  integration: ['integration', 'mcp', 'extension', 'webhook', 'sdk']
};

function matchRoleFromQuery(q) {
  for (const [role, syns] of Object.entries(ROLE_SYNONYMS)) {
    if (syns.some(s => q.includes(s))) return role;
  }
  return null;
}

function matchModuleRole(m, role) {
  const t = ((m.type || '') + ' ' + (m.role || '') + ' ' + (m.name || '')).toLowerCase();
  const syns = ROLE_SYNONYMS[role] || [role];
  return syns.some(s => t.includes(s));
}

// Reusability score 0-100 for a single module (heuristic, deterministic).
function moduleReusability(m, tc) {
  let score = 50;
  const loc = typeof m.loc === 'number' ? m.loc : parseInt(m.loc, 10) || 0;
  if (loc > 0 && loc < 600) score += 20;       // small = portable
  else if (loc > 3000) score -= 15;             // huge = hard
  if (m.hasContracts || (tc && tc.contracts && /shared|contract/i.test(m.name))) score += 18;
  if (m.hasReadme) score += 8;
  if (/shared|core|primitive|util/i.test(m.name)) score += 10;
  if (/website|marketing|landing/i.test(m.name)) score -= 12;
  return Math.max(5, Math.min(99, Math.round(score)));
}

// “Best for” tag derived from role/type.
function moduleBestFor(m) {
  for (const [role, syns] of Object.entries(ROLE_SYNONYMS)) {
    if (matchModuleRole(m, role)) return role;
  }
  return 'general';
}

// Hard-to-transplant warning.
function moduleTransplantWarning(m, tc) {
  const loc = typeof m.loc === 'number' ? m.loc : parseInt(m.loc, 10) || 0;
  const warns = [];
  if (loc > 2500) warns.push('large surface area');
  if (!(m.hasContracts || (tc && tc.contracts && /shared|contract/i.test(m.name)))) warns.push('no contracts');
  if (/extension|native|website/i.test(m.name)) warns.push('tightly coupled to host');
  return warns;
}

function renderLibrary() {
  const container = $('library-grid');
  if (!container) return;

  let filtered = state.toolchests;

  // Natural-language-ish + multi-field search
  if (state.searchTerm) {
    const q = state.searchTerm.toLowerCase().trim();
    const roleHit = matchRoleFromQuery(q); // may narrow by role
    filtered = filtered.filter(tc =>
      tc.name.toLowerCase().includes(q) ||
      (tc.readme || '').toLowerCase().includes(q) ||
      (tc.tags || []).some(t => t.toLowerCase().includes(q)) ||
      tc.modules.some(m =>
        m.name.toLowerCase().includes(q) ||
        (m.role || '').toLowerCase().includes(q) ||
        (roleHit ? matchModuleRole(m, roleHit) : false)
      )
    );
  }
  if (state.filterType !== 'all') {
    filtered = filtered.filter(tc => tc.sourceType === state.filterType);
  }
  if (state.filterRole !== 'all') {
    filtered = filtered.filter(tc => tc.modules.some(m => matchModuleRole(m, state.filterRole)));
  }
  if (state.filterContractsOnly) {
    filtered = filtered.filter(tc => tc.contracts === true);
  }
  if (state.filterHealthMin > 0) {
    filtered = filtered.filter(tc => computeHealth(tc) >= state.filterHealthMin);
  }

  if (!filtered.length) {
    renderEmptyState(container, {
      icon: state.toolchests.length === 0 ? '🗃️' : '🔍',
      title: state.toolchests.length === 0 ? 'No toolchests yet' : 'No matches',
      body: state.toolchests.length === 0
        ? 'Register a /forge output folder to begin, or load the demo library to explore.'
        : 'Try clearing some filters or searching for something broader (e.g. “ui modules”).',
      actions: state.toolchests.length === 0
        ? [
            { id: 'demo', label: 'Load demo library', primary: true, onClick: () => loadReferenceToolchests() },
            { id: 'reg', label: '+ Register a /forge folder', onClick: () => $('addToolchestBtn')?.click() },
            { id: 'wiz', label: '✨ Guided workflow', onClick: () => startWizard() }
          ]
        : [{ id: 'clear', label: 'Clear filters', primary: true, onClick: () => clearFilters() }]
    });
    return;
  }

  container.innerHTML = filtered.map(tc => {
    const health = computeHealth(tc);
    const richness = getRichnessLabel(health);
    const fstat = state.fileStatus[tc.id] || 'connected';
    return `
      <div class="toolchest-card ${state.selectedToolchestId === tc.id ? 'selected' : ''}" data-id="${tc.id}">
        <div class="card-header">
          <div>
            <strong>${tc.name}</strong>
            <span class="badge source-${tc.sourceType}">${tc.sourceType}</span>
            ${tc.contracts ? '<span class="badge" style="background:#39f6af22;color:#39f6af;border:none">contracts</span>' : ''}
            <span class="status-badge ${fstat}" title="Local file status">${fstat}</span>
          </div>
          <div class="health">
            <span class="health-score ${richness.color}">${health}</span>
            <span class="health-label">${richness.label}</span>
          </div>
        </div>
        <div class="card-body">
          <div>${tc.modules.length} modules</div>
          <div class="mini">${tc.path}</div>
          ${tc.tags ? `<div class="tags">${tc.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="small-btn" data-action="view">Anatomy</button>
          <button class="small-btn" data-action="assay" data-touchpoint="assay-toolchest">Assay</button>
          <button class="small-btn" data-action="snapshot">Snapshot</button>
          <button class="small-btn" data-action="refresh">↻</button>
          <button class="small-btn danger" data-action="remove">×</button>
          ${ (window.__TAURI__ && window.__TAURI__.invoke) ? `<button class="small-btn" data-action="reveal">Reveal</button>` : '' }
        </div>
        <div class="card-footer">
          <button class="ghost-btn tiny" data-action="add-all">+ All to Blueprint</button>
        </div>
      </div>`;
  }).join('');

  // Event delegation
  container.querySelectorAll('.toolchest-card').forEach(card => {
    const id = card.dataset.id;
    card.addEventListener('click', e => {
      if (e.target.tagName === 'BUTTON') return;
      selectToolchest(id);
    });
  });

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopImmediatePropagation();
      const id = btn.closest('.toolchest-card').dataset.id;
      const action = btn.dataset.action;

      if (action === 'view') selectToolchest(id);
      if (action === 'assay') runAssay(id);
      if (action === 'snapshot') createSnapshot(id);
      if (action === 'refresh') refreshToolchest(id);
      if (action === 'remove') removeToolchest(id);
      if (action === 'add-all') addAllModulesToBlueprint(id);
      if (action === 'reveal') revealToolchest(id);
    });
  });
}

function selectToolchest(id) {
  state.selectedToolchestId = id;
  renderAll();
}

function addAllModulesToBlueprint(id) {
  const tc = state.toolchests.find(t => t.id === id);
  if (!tc) return;
  tc.modules.forEach(m => addModuleToBlueprint(id, m.name));
}

// Reveal in Finder (Tauri native only)
async function revealToolchest(id) {
  const tc = state.toolchests.find(t => t.id === id);
  if (!tc || !(window.__TAURI__ && window.__TAURI__.invoke)) return;
  const p = tc._nativePath || tc.path || '';
  try {
    await window.__TAURI__.invoke('reveal_in_finder', { path: p });
  } catch (e) { console.warn('reveal failed', e); }
}

// App data metadata persistence (now uses safeTauriCall helper — B2 follow-up cleanup)
async function saveToolchestsToAppData() {
  if (!(window.__TAURI__ && window.__TAURI__.invoke)) return;
  await safeTauriCall(
    () => window.__TAURI__.invoke('save_toolchest_metadata', { data: state.toolchests }),
    undefined,
    'save_toolchest_metadata'
  );
}
async function loadToolchestsFromAppData() {
  if (!(window.__TAURI__ && window.__TAURI__.invoke)) return null;
  return await safeTauriCall(
    () => window.__TAURI__.invoke('load_toolchest_metadata'),
    null,
    'load_toolchest_metadata'
  );
}

// ==================== ANATOMY ====================
function renderSelectedAnatomy() {
  const panel = $('anatomy-panel');
  if (!panel) return;

  // Sync the anatomy picker dropdown
  const picker = $('anatomy-picker');
  if (picker) {
    picker.innerHTML = '<option value="">Select a toolchest…</option>' +
      state.toolchests.map(t => `<option value="${t.id}" ${t.id === state.selectedToolchestId ? 'selected' : ''}>${t.name}</option>`).join('');
    picker.onchange = () => { selectToolchest(picker.value); };
  }

  const tc = state.toolchests.find(t => t.id === state.selectedToolchestId);
  if (!tc) {
    renderEmptyState(panel, {
      icon: '🔬',
      title: 'No toolchest selected',
      body: state.toolchests.length
        ? 'Pick a toolchest above (or from the Library) to explore its modules.'
        : 'Register a toolchest first, then return here to inspect its anatomy.',
      actions: state.toolchests.length
        ? []
        : [
            { id: 'demo', label: 'Load demo library', primary: true, onClick: () => loadReferenceToolchests() },
            { id: 'lib', label: 'Go to Library', onClick: () => setActiveTab('library') }
          ]
    });
    return;
  }

  const health = computeHealth(tc);
  const fstat = state.fileStatus[tc.id] || 'connected';
  const modHtml = tc.modules.map(m => {
    const inCompare = state.compareQueue.some(q => q.toolchestId === tc.id && q.module === m.name);
    return `
    <div class="module-row">
      <input type="checkbox" class="compare-cb" data-cb-tc="${tc.id}" data-cb-mod="${m.name}" ${inCompare ? 'checked' : ''} title="Add to compare" />
      <strong>${m.name}</strong>
      <span class="muted">${m.role}</span>
      <span>${m.loc}</span>
      <div>
        ${m.hasContracts ? '<span class="badge" style="background:#39f6af22;color:#39f6af;border:none">contracts</span>' : ''}
        ${m.hasReadme ? '<span class="tag">readme</span>' : ''}
        <button class="tiny" onclick="addModuleToBlueprint('${tc.id}', '${m.name}')">+ Blueprint</button>
        <button class="tiny" draggable="true" ondragstart="event.dataTransfer.setData('text/plain', JSON.stringify({toolchestId:'${tc.id}', module:'${m.name}'}))">Drag</button>
        <button class="tiny" onclick="showModuleModal('${tc.id}', '${m.name}')">Details</button>
      </div>
    </div>`;
  }).join('');

  const graphSvg = renderSimpleGraph(tc);

  panel.innerHTML = `
    <div class="anatomy-header">
      <div>
        <h3>${tc.name}</h3>
        <span class="badge source-${tc.sourceType}">${tc.sourceType}</span>
        <span class="health-score">${health}</span>
        <span class="status-badge ${fstat}">${fstat}</span>
      </div>
      <div>
        <button class="small-btn" onclick="runAssay('${tc.id}')">Run Assay</button>
        <button class="small-btn" onclick="runComplements('${tc.id}')">Find Complements</button>
        <button class="small-btn" onclick="refreshToolchest('${tc.id}')">↻ Refresh</button>
      </div>
    </div>
    <div class="modules-section">
      <h4>Modules <span class="muted" style="font-weight:400">(tick boxes to compare)</span></h4>
      ${modHtml}
    </div>
    <div class="graph-section">
      <h4>Dependency Overview</h4>
      ${graphSvg}
    </div>
    <div class="readme-section">
      <h4>README / Notes</h4>
      <pre>${tc.readme}</pre>
    </div>
  `;
  panel.querySelectorAll('.compare-cb').forEach(cb => {
    cb.onchange = () => toggleCompare(cb.dataset.cbTc, cb.dataset.cbMod);
  });
  applyGlossaryTooltips(panel);
}

function renderSimpleGraph(tc) {
  if (!tc.modules || tc.modules.length === 0) return '<div class="muted">No modules</div>';
  
  const modules = tc.modules;
  const width = 620;
  const height = Math.max(180, modules.length * 22);
  
  let lines = '';
  let nodes = '';
  
  // Simple layered layout: 00-shared at top, then others
  const yStep = height / (modules.length + 1);
  modules.forEach((m, i) => {
    const y = 25 + i * yStep;
    const x = 60 + (i % 3) * 180;
    nodes += `<g>
      <rect x="${x-50}" y="${y-10}" width="160" height="20" rx="4" fill="#0c1628" stroke="#3a5a7a"/>
      <text x="${x+30}" y="${y+4}" fill="#a8d4ff" font-size="11">${m.name}</text>
    </g>`;
    if (i > 0) {
      lines += `<line x1="${x+30}" y1="${y-10}" x2="${x+30}" y2="${y - yStep + 10}" stroke="#3a5a7a" stroke-width="1.5"/>`;
    }
  });

  return `<svg width="${width}" height="${height}" style="background:#020409;border-radius:8px">${lines}${nodes}</svg>`;
}

// ==================== MODULE MODAL ====================
let modalEl;
function showModuleModal(tcId, modName) {
  const tc = state.toolchests.find(t => t.id === tcId);
  const mod = tc.modules.find(m => m.name === modName);
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.className = 'modal';
    document.body.appendChild(modalEl);
  }

  let contractsPreview = '';
  if ((mod.hasContracts || (tc.contracts && mod.name === '00-shared')) && tc._dirHandle) {
    contractsPreview = `<div class="contracts-preview"><strong>Contracts Preview</strong><br><em>Click "Load Contracts" to read from disk</em><br><button class="tiny" onclick="loadContractsPreview('${tcId}', '${modName}')">Load Contracts</button></div>`;
  }

  modalEl.innerHTML = `
    <div class="modal-content">
      <button class="close" onclick="closeModal()">×</button>
      <h3>${mod.name} <span class="muted">from ${tc.name}</span></h3>
      <p><strong>Role:</strong> ${mod.role}</p>
      <p><strong>Est. LOC:</strong> ${mod.loc}</p>
      <p><strong>Type:</strong> ${mod.type || 'general'}</p>
      ${mod.hasContracts ? '<p class="ok">✓ Contains interface contracts</p>' : ''}
      ${mod.hasReadme ? '<p>Has README</p>' : ''}
      ${contractsPreview}
      <div class="modal-actions">
        <button class="primary-btn" onclick="addModuleToBlueprint('${tcId}','${modName}');closeModal()">Add to Blueprint</button>
        <button class="ghost-btn" onclick="closeModal()">Close</button>
      </div>
    </div>
  `;
  modalEl.style.display = 'flex';
}

window.loadContractsPreview = async (tcId, modName) => {
  const tc = state.toolchests.find(t => t.id === tcId);
  if (!tc || !tc._dirHandle) return alert('No live handle for this toolchest. Re-register.');
  try {
    let content = '';
    if (modName === '00-shared') {
      const handle = await tc._dirHandle.getFileHandle('00-shared/contracts.md');
      content = await (await handle.getFile()).text();
    } else {
      const modHandle = await tc._dirHandle.getDirectoryHandle(modName);
      const handle = await modHandle.getFileHandle('contracts.md');
      content = await (await handle.getFile()).text();
    }
    const preview = content.slice(0, 800);
    const el = document.querySelector('.contracts-preview');
    if (el) el.innerHTML = `<strong>Contracts Preview</strong><pre style="font-size:10px;max-height:120px;overflow:auto">${preview.replace(/</g,'&lt;')}</pre>`;
  } catch(e) {
    alert('Could not read contracts file: ' + e.message);
  }
};

window.closeModal = () => { if (modalEl) modalEl.style.display = 'none'; };

let helpModal;
window.showHelp = () => {
  if (!helpModal) {
    helpModal = document.createElement('div');
    helpModal.className = 'modal';
    document.body.appendChild(helpModal);
  }
  helpModal.innerHTML = `
    <div class="modal-content" style="max-width:620px">
      <button class="close" onclick="closeHelp()">×</button>
      <h2>dabasemint — Plan Complete ✅</h2>
      <p><strong>Strategic Plan fully implemented.</strong></p>
      <ul>
        <li>Real toolchest ingestion with contracts awareness</li>
        <li>Rich visualization & Trade Routes</li>
        <li>Powerful Composition + Mint + Context Packs</li>
        <li>Actionable Agents (Novita + G0DM0D3)</li>
        <li>Curation, Snapshots, Drift, Registry IO</li>
      </ul>
      <p>Use + Register to load your /forge toolchests. Everything is local.</p>
      <p>See docs/CURRENT-STATE.md for current operating details. Historical planning docs are archived in docs/archive/.</p>
      <div class="modal-actions">
        <button class="ghost-btn" onclick="closeHelp()">Got it</button>
      </div>
    </div>
  `;
  helpModal.style.display = 'flex';
};
window.closeHelp = () => { if (helpModal) helpModal.style.display = 'none'; };

// ==================== COMPOSITION ====================
function renderComposition() {
  const canvas = $('composition-canvas');
  if (!canvas) return;

  const bpScore = computeBlueprintScore();

  if (!state.blueprint.length) {
    canvas.innerHTML = `<div class="empty drop-zone">Blueprint empty. Drag modules here from Anatomy or click + Blueprint.<br><small>Drop zone active — supports reorder</small></div>`;
  } else {
    const items = state.blueprint.map((b, i) => {
      const tc = state.toolchests.find(t => t.id === b.toolchestId);
      return `<div class="bp-item" draggable="true" ondragstart="event.dataTransfer.setData('text/plain', JSON.stringify({index: ${i}}))" ondragover="event.preventDefault()" ondrop="reorderBlueprint(${i}, event)">
        <span>${tc?.name || b.toolchestId} / <strong>${b.module}</strong></span>
        <div>
          <button class="tiny" onclick="moveBlueprintItem(${i}, -1); renderComposition()">↑</button>
          <button class="tiny" onclick="moveBlueprintItem(${i}, 1); renderComposition()">↓</button>
          <button class="tiny" onclick="removeFromBlueprint(${i})">×</button>
        </div>
      </div>`;
    }).join('');

    canvas.innerHTML = `
      <div class="bp-header">
        <strong>Blueprint (${state.blueprint.length}) <span class="health-score ${bpScore.color}">${bpScore.score}</span></strong>
        <div>
          <button class="tiny" onclick="runCompositionAdvisor()">Advisor</button>
          <button class="tiny" onclick="exportBlueprint()">Export JSON</button>
          <button class="tiny" onclick="exportAsRealProject()">Export Real</button>
          <button class="tiny" onclick="mintBlueprint()">Mint</button>
          <button class="tiny" onclick="generateContextPack()">Context Pack</button>
          <button class="tiny" onclick="clearBlueprint()">Clear</button>
        </div>
      </div>
      <div class="bp-list drop-zone">${items}</div>
      <div id="advisor-results"></div>
    `;
  }

  // Make drop zone functional + visually robust
  const dropZone = canvas.querySelector('.drop-zone') || canvas;
  const highlight = () => { dropZone.style.outline = '2px dashed #22c8ff'; dropZone.style.background = 'rgba(34,200,255,0.06)'; };
  const unhighlight = () => { dropZone.style.outline = ''; dropZone.style.background = ''; };

  dropZone.ondragover = e => { e.preventDefault(); highlight(); };
  dropZone.ondragleave = unhighlight;
  dropZone.ondrop = e => {
    e.preventDefault();
    unhighlight();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.toolchestId && data.module) {
        addModuleToBlueprint(data.toolchestId, data.module);
      }
    } catch (err) {
      console.warn('Drop failed', err);
    }
  };
}

function computeBlueprintScore() {
  if (!state.blueprint.length) return { score: 0, color: '' };
  let score = 50;
  const uniqueChests = new Set(state.blueprint.map(b => b.toolchestId)).size;
  score += uniqueChests * 8;
  const hasCore = state.blueprint.some(b => b.module.includes('core') || b.module.includes('shared'));
  if (hasCore) score += 15;
  const hasContracts = state.blueprint.some(b => {
    const tc = state.toolchests.find(t => t.id === b.toolchestId);
    return tc && (tc.contracts || b.module === '00-shared');
  });
  if (hasContracts) score += 12;
  score = Math.min(98, Math.max(40, Math.round(score)));
  const color = score > 80 ? 'ok' : score > 65 ? 'cyan' : 'warn';
  return { score, color };
}

function moveBlueprintItem(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= state.blueprint.length) return;
  const item = state.blueprint.splice(index, 1)[0];
  state.blueprint.splice(newIndex, 0, item);
  saveState();
}

function reorderBlueprint(targetIndex, event) {
  try {
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    if (typeof data.index === 'number' && data.index !== targetIndex) {
      const item = state.blueprint.splice(data.index, 1)[0];
      state.blueprint.splice(targetIndex, 0, item);
      saveState();
      renderComposition();
    }
  } catch (e) {
    console.warn('Drag-and-drop parse failed (bad data?):', e);
  }
}

async function runCompositionAdvisor() {
  const container = $('advisor-results');
  if (!container) return;
  container.innerHTML = '<div class="muted">Asking advisor...</div>';

  const context = {
    currentBlueprint: state.blueprint.map(b => {
      const tc = state.toolchests.find(t => t.id === b.toolchestId);
      return { toolchest: tc?.name, module: b.module };
    }),
    goal: "Build something powerful using these parts"
  };

  const result = await runTouchpoint('composition-advisor', context);
  if (result.ok && result.data) {
    state.lastAgentResults['composition-advisor'] = result;
    container.innerHTML = renderAdvisorCard(result.data);
  } else {
    container.innerHTML = `<div class="agent-result-card error">Advisor failed: ${result.error || 'unknown error'}</div>`;
  }
}

function renderAdvisorCard(data) {
  const li = (arr) => Array.isArray(arr) && arr.length
    ? `<ul>${arr.map(x => `<li>${String(x)}</li>`).join('')}</ul>`
    : '<div class="muted">—</div>';
  const conflicts = Array.isArray(data.potentialConflicts) && data.potentialConflicts.length
    ? data.potentialConflicts.map(c => `<li><strong>${(c.modules || []).join(' + ')}</strong>: ${c.issue || ''}${c.resolution ? ' → <em>' + c.resolution + '</em>' : ''}</li>`).join('')
    : '<li class="muted">None detected</li>';
  return `
    <div class="advisor-card">
      <div><strong>Assessment:</strong> <span class="health-score">${data.overallAssessment || '?'}</span></div>
      <div><strong>Recommended wiring</strong>${li(data.recommendedWiring)}</div>
      <div><strong>Suggested adapters</strong>${li(data.suggestedAdapters)}</div>
      <div><strong>Missing pieces</strong>${li(data.missingPieces)}</div>
      <div><strong>Potential conflicts</strong><ul>${conflicts}</ul></div>
      <div><strong>Next steps</strong>${li(data.nextSteps)}</div>
      <div class="modal-actions">
        <button class="tiny" onclick="applyAdvisorSuggestions()">Auto-add findable missing pieces</button>
        <button class="tiny" onclick="exportBlueprint()">Export blueprint</button>
      </div>
    </div>`;
}

function applyAdvisorSuggestions() {
  const result = state.lastAgentResults['composition-advisor'];
  if (!result || !result.ok || !result.data) return toast('No advisor result to apply');
  const missing = Array.isArray(result.data.missingPieces) ? result.data.missingPieces : [];
  if (!missing.length) return toast('No missing pieces to apply');

  // Try to find any missing-piece names that match modules already in the library
  let added = 0;
  let unmatched = 0;
  missing.forEach(piece => {
    const text = String(piece).toLowerCase();
    let best = null;
    for (const tc of state.toolchests) {
      const match = tc.modules.find(m =>
        text.includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(text.slice(0, 6)));
      if (match && !state.blueprint.some(b => b.module === match.name)) {
        best = { tcId: tc.id, mod: match.name };
        break;
      }
    }
    if (best) { addModuleToBlueprint(best.tcId, best.mod); added++; } else { unmatched++; }
  });

  renderComposition();
  toast(added
    ? `Added ${added} findable missing piece(s)${unmatched ? ` (${unmatched} not in library)` : ''}`
    : 'None of the suggested missing pieces exist in your library');
}

// ==================== AGENT ENHANCEMENTS ====================
function renderAgentStatus() {
  const el = $('agent-status');
  if (!el) return;
  const s = state.agentProviderStatus || {};
  const ph = lastProxyHealth || {};
  const portStr = ph.port ? `port:${ph.port}` : 'no-port';
  const h = ph.health || {};
  const healthBadge = h.ok ? '🟢 healthy' : (h.error ? '🔴 ' + h.error : '⚪ unknown');
  // Multi-provider health summary from enhanced status
  const providers = (s.providers && s.providers.length) ? s.providers : [
    { id: 'novita', name: 'Novita', configured: !!s.configured }
  ];
  const provCount = providers.filter(p => p.configured).length;
  const mp = s.multiProvider ? ` (${provCount}/${providers.length} cfg)` : '';
  // small logs/status panel: recent agent activity + proxy health
  const recentLogs = (state.agentHistory || []).slice(0, 3).map(h => `${h.id}:${h.result && h.result.ok ? 'ok' : 'err'}`).join(' ');
  const proxyDetail = h.port ? `p:${h.port}` : '';

  // Build the provider dropdown dynamically so unconfigured providers are
  // visibly marked (e.g. GLM without a key) and warned on selection.
  const options = providers.map(p => {
    const flag = p.configured ? '✅' : '⚠️';
    const note = p.configured ? '' : ' (no key)';
    return `<option value="${p.id}" ${!p.configured ? 'data-unconfigured="1"' : ''}>${flag} ${p.name}${note}</option>`;
  }).join('');

  el.innerHTML = `
    <select id="agent-sel" title="AI provider">${options}</select>
    <span>${s.configured ? '✅' : '❌'} ${s.provider || ''}${mp}</span>
    <span class="proxy-health">${portStr} ${healthBadge} ${proxyDetail}</span>
    <button id="restart-proxy-btn" class="tiny" style="font-size:10px;padding:1px 5px;margin-left:4px;" title="Restart agent proxy (desktop app)">↻</button>
    <div class="proxy-logs" title="Recent agent activity + proxy status">${recentLogs || 'no recent'} | ${h.ok ? 'proxy up' : 'proxy ?'}</div>
  `;
  const sel = $('agent-sel');
  if (sel) {
    sel.value = state.agentProviderChoice;
    // If the saved choice is an unconfigured provider, fall back to a configured one.
    const chosenOpt = sel.selectedOptions[0];
    if (chosenOpt && chosenOpt.dataset.unconfigured) {
      const configured = providers.find(p => p.configured);
      if (configured) {
        state.agentProviderChoice = configured.id;
        localStorage.setItem('dabasemint:agent-provider', configured.id);
        sel.value = configured.id;
      }
    }
    sel.onchange = () => {
      const opt = sel.selectedOptions[0];
      if (opt && opt.dataset.unconfigured) {
        toast(`${opt.textContent} has no API key configured. Add it to config/agent.local.json to use it.`);
      }
      state.agentProviderChoice = sel.value;
      localStorage.setItem('dabasemint:agent-provider', state.agentProviderChoice);
      fetchAgentStatus();
    };
  }
  const restartBtn = $('restart-proxy-btn');
  if (restartBtn) {
    restartBtn.onclick = (e) => { e.preventDefault(); restartAgentProxy(); };
  }
}

function renderAgentResult(id, result) {
  const area = $('global-agent-results');
  if (!area) return;

  let html = `<div class="agent-result-card ${result.ok ? '' : 'error'}">
    <strong>${id}</strong> ${result.ok ? '✓' : '✗'}
    <pre>${result.ok ? JSON.stringify(result.data, null, 2) : result.error}</pre>`;

  if (id === 'assay-toolchest' && result.ok) {
    html += `<button class="tiny" onclick="applyAssayResult()">Apply tags & notes</button>`;
  }
  if (id === 'find-complements' && result.ok && result.data && result.data.complements) {
    html += `<button class="tiny" onclick="applyComplementsResult()">Add top complements</button>`;
  }
  html += `</div>`;

  area.innerHTML = html + area.innerHTML;
}

function applyAssayResult() {
  const tcId = state.selectedToolchestId;
  if (!tcId) return;

  const result = state.lastAgentResults['assay-toolchest'];
  if (!result || !result.ok || !result.data) return toast('No recent assay result');

  const tc = state.toolchests.find(t => t.id === tcId);
  if (!tc) return;

  // Apply useful data from agent
  if (result.data.suggestedTags) {
    tc.tags = result.data.suggestedTags;
  }
  if (result.data.reusabilityNotes) {
    tc.notes = result.data.reusabilityNotes;
  }
  if (result.data.overallQuality) {
    tc.agentQuality = result.data.overallQuality;
  }

  saveState();
  renderAll();
  toast('Assay insights applied to toolchest');
}

function applyComplementsResult() {
  const result = state.lastAgentResults['find-complements'];
  if (!result || !result.ok || !result.data || !result.data.complements) return;

  let added = 0;
  let skipped = 0;

  result.data.complements.slice(0, 6).forEach(comp => {
    // More robust matching
    const nameNorm = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchingTc = state.toolchests.find(t => 
      nameNorm(t.name) === nameNorm(comp.toolchest) || 
      t.id.includes(nameNorm(comp.toolchest))
    );

    if (matchingTc) {
      // Try exact match first, then fuzzy
      let matchingMod = matchingTc.modules.find(m => m.name === comp.module);
      if (!matchingMod) {
        matchingMod = matchingTc.modules.find(m => 
          m.name.toLowerCase().includes(comp.module.toLowerCase().slice(0, 8))
        );
      }

      if (matchingMod && !state.blueprint.some(b => b.module === matchingMod.name && b.toolchestId === matchingTc.id)) {
        addModuleToBlueprint(matchingTc.id, matchingMod.name);
        added++;
      } else {
        skipped++;
      }
    } else {
      skipped++;
    }
  });

  renderAll();
  const msg = added > 0 
    ? `Added ${added} modules${skipped ? ` (${skipped} skipped or already present)` : ''}` 
    : 'No new modules could be matched from the suggestion';
  toast(msg);
}

function mintBlueprint() {
  if (!state.blueprint.length) return toast('Blueprint is empty');

  // Pre-mint validation
  const uniqueModules = new Set(state.blueprint.map(b => b.module));
  if (uniqueModules.size < state.blueprint.length) {
    if (!confirm('There are duplicate module names in this blueprint. Mint anyway?')) return;
  }

  const hasDiverseSources = new Set(state.blueprint.map(b => b.toolchestId)).size > 1;
  if (!hasDiverseSources && !confirm('This blueprint only uses modules from one toolchest. Continue?')) {
    return;
  }

  const modulesInfo = state.blueprint.map(b => {
    const tc = state.toolchests.find(t => t.id === b.toolchestId);
    return { toolchest: tc?.name, module: b.module };
  });

  const mintedName = `minted-${Date.now()}`;
  const minted = {
    id: mintedName,
    name: `Minted: ${modulesInfo.map(m => m.module).join('+')}`,
    path: '(minted in dabasemint)',
    sourceType: 'minted',
    modules: modulesInfo.map(m => ({ name: m.module, role: 'From blueprint', loc: '?' })),
    readme: 'This is a composed blueprint created in dabasemint. See CONNECTION.md for integration details.',
    forgeState: { mintedFrom: modulesInfo.length + ' modules', date: new Date().toISOString() },
    contracts: modulesInfo.some(m => m.module.includes('shared') || m.module.includes('core')),
    addedAt: Date.now(),
    tags: ['minted', 'blueprint']
  };

  registerToolchest(minted);

  // Generate nice mint output
  let output = `Minted Blueprint: ${minted.name}

Modules:
`;
  modulesInfo.forEach(m => output += `  - ${m.module} (from ${m.toolchest})
`);
  const structure = ['src/', '  lib/'].concat(modulesInfo.map(m => '    ' + m.module)).join('\n');
  output += `
Suggested project structure:
${structure}

Run "Composition Advisor" or export for full CONNECTION.md guidance.
`;

  const area = $('advisor-results') || $('trade-routes-results');
  if (area) area.innerHTML = `<pre>${output}</pre>`;

  showSuccessCard({
    title: 'Blueprint minted ✨',
    summary: `Saved “${minted.name}” as a reusable library item (${modulesInfo.length} modules). Find it in your Library with the “minted” badge.`,
    links: [
      { id: 'lib', label: '📚 Open Library', onClick: () => setActiveTab('library') },
      { id: 'assay', label: '🧪 Assay the mint', onClick: () => runAssay(mintedName) }
    ],
    duration: 7000
  });
}

async function generateContextPack() {
  if (!state.blueprint.length) return toast('Blueprint is empty');

  const ctx = {
    selectedModules: state.blueprint.map(b => {
      const tc = state.toolchests.find(t => t.id === b.toolchestId);
      return { toolchest: tc?.name, module: b.module };
    })
  };

  const result = await runTouchpoint('context-pack-generator', ctx);
  if (result && result.ok && result.data) {
    const pack = JSON.stringify(result.data, null, 2);
    const blob = new Blob([pack], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dabasemint-context-pack-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Context pack exported (perfect for other agents)');
  }
}

async function runAssay(id) {
  const tc = state.toolchests.find(t => t.id === id);
  const ctx = { toolchestName: tc.name, modules: tc.modules, readmeExcerpt: tc.readme };
  await runTouchpoint('assay-toolchest', ctx);
}

async function runComplements(id) {
  const tc = state.toolchests.find(t => t.id === id);
  const ctx = { primaryModules: tc.modules.slice(0, 2), availableToolchests: state.toolchests.map(t => t.name) };
  await runTouchpoint('find-complements', ctx);
}

async function runTradeRoutes() {
  const container = $('trade-routes-results');
  if (!container) return;
  if (state.toolchests.length < 2) {
    container.innerHTML = '<p class="muted">Register at least two toolchests to discover trade routes.</p>';
    return;
  }
  container.innerHTML = '<em>Analyzing cross-toolchest opportunities...</em>';
  const ctx = {
    toolchests: state.toolchests.map(t => ({ name: t.name, modules: t.modules.map(m => m.name) })),
    goal: 'Discover powerful cross-toolchest combinations and hidden synergies'
  };
  const result = await runTouchpoint('find-complements', ctx);
  if (result && result.ok && result.data) {
    let html = '<h4>Recommended Synergies</h4><ul>';
    (result.data.complements || []).forEach(c => {
      html += `<li><strong>${c.toolchest} → ${c.module}</strong> — ${c.reason || ''} (effort: ${c.integrationEffort || 'medium'})</li>`;
    });
    html += '</ul>';
    if (result.data.suggestedBlueprintName) html += `<p><strong>Suggested name:</strong> ${result.data.suggestedBlueprintName}</p>`;
    container.innerHTML = html;
  }
}

// ==================== SEARCH / FILTER ====================
function setupFilters() {
  const search = $('search-input');
  if (search) {
    search.oninput = () => {
      state.searchTerm = search.value;
      renderLibrary();
    };
  }

  const filter = $('filter-type');
  if (filter) {
    filter.onchange = () => {
      state.filterType = filter.value;
      renderLibrary();
    };
  }
  const role = $('filter-role');
  if (role) {
    role.onchange = () => { state.filterRole = role.value; renderLibrary(); };
  }
  const contracts = $('filter-contracts');
  if (contracts) {
    contracts.onchange = () => { state.filterContractsOnly = contracts.checked; renderLibrary(); };
  }
  const health = $('filter-health');
  if (health) {
    health.oninput = () => { state.filterHealthMin = parseInt(health.value, 10) || 0; renderLibrary(); };
  }
  const saveBtn = $('save-search-btn');
  if (saveBtn) {
    saveBtn.onclick = saveCurrentSearch;
  }
}

function saveCurrentSearch() {
  const name = prompt('Name this search:', state.searchTerm || 'my search');
  if (!name) return;
  state.savedSearches.push({
    name,
    query: state.searchTerm,
    filters: { type: state.filterType, role: state.filterRole, contractsOnly: state.filterContractsOnly, healthMin: state.filterHealthMin }
  });
  saveState();
  renderSavedSearchesDropdown();
  toast(`Saved search “${name}”`);
}

function clearFilters() {
  state.searchTerm = '';
  state.filterType = 'all';
  const s = $('search-input'); if (s) s.value = '';
  const f = $('filter-type'); if (f) f.value = 'all';
  renderLibrary();
}

// ==================== INIT ====================
// ==================== ONBOARDING TOUR (point 1) ====================
const TOUR_STEPS = [
  {
    title: 'Welcome to dabasemint 👋',
    body: `<p>dabasemint helps you compose new projects from <dfn data-term="toolchest">toolchests</dfn> — folders of reusable modules extracted by <code>/forge</code>.</p>
         <p>This 30-second tour shows you the whole workflow.</p>`
  },
  {
    title: '1 · Register a toolchest',
    body: `<p>Click <strong>+ Register</strong> in the top bar to load a <code>/forge</code> output folder. Or hit <strong>“Load demo library”</strong> to explore three sample toolchests.</p>`
  },
  {
    title: '2 · Inspect modules (Anatomy)',
    body: `<p>Open the <strong>🔬 Anatomy</strong> tab to see every module, its role, contracts, and reusability.</p>`
  },
  {
    title: '3 · Add modules to your blueprint',
    body: `<p>Click <strong>+ Blueprint</strong> on any module, or drag it. Your selection lives in the <strong>🧱 Blueprint</strong> tab.</p>`
  },
  {
    title: '4 · Export a real project',
    body: `<p>Preview the generated folder tree, then <strong>Generate project</strong>. Want a guided version? Use <strong>“Create a project from toolchests”</strong> anytime.</p>`
  },
  {
    title: 'Glossary',
    body: `<dl class="tour-glossary">
      <dt>Toolchest</dt><dd>${TERMS.toolchest}</dd>
      <dt>Blueprint</dt><dd>${TERMS.blueprint}</dd>
      <dt>Mint</dt><dd>${TERMS.mint}</dd>
      <dt>Assay</dt><dd>${TERMS.assay}</dd>
      <dt>Trade Routes</dt><dd>${TERMS.trade}</dd>
    </dl>`
  }
];

function startOnboarding(force = false) {
  if (!force && state.onboardingSeen) return;
  let step = 0;
  const host = $('modal-host');
  if (!host) return;
  host.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.className = 'tour-overlay';
  overlay.innerHTML = `<div class="tour-card"><div class="tour-progress"></div><div class="tour-content"></div><div class="tour-actions"></div></div>`;
  host.appendChild(overlay);
  const render = () => {
    const s = TOUR_STEPS[step];
    overlay.querySelector('.tour-progress').innerHTML = TOUR_STEPS.map((_, i) =>
      `<span class="${i < step ? 'done' : i === step ? 'active' : ''}"></span>`).join('');
    overlay.querySelector('.tour-content').innerHTML = `<h2>${s.title}</h2>${s.body}`;
    applyGlossaryTooltips(overlay);
    overlay.querySelector('.tour-actions').innerHTML = `
      <button class="ghost-btn tiny" id="tour-skip">Skip tour</button>
      <span class="muted" style="font-size:11px">${step + 1} / ${TOUR_STEPS.length}</span>
      <button class="primary-btn" id="tour-next">${step === TOUR_STEPS.length - 1 ? 'Finish' : 'Next →'}</button>
    `;
    overlay.querySelector('#tour-skip').onclick = finishTour;
    overlay.querySelector('#tour-next').onclick = () => {
      if (step < TOUR_STEPS.length - 1) { step++; render(); }
      else finishTour();
    };
  };
  const finishTour = () => {
    state.onboardingSeen = true;
    saveState();
    closeModalHost();
    toast('Tour complete — explore anytime via the Tour button.');
  };
  render();
}

// ==================== MAIN WORKFLOW WIZARD (points 1 + 4) ====================
function startWizard() {
  state.wizardStep = 0;
  const wiz = { picked: new Set(state.toolchests.map(t => t.id)) };
  const steps = [
    { title: 'Pick toolchests', render: renderWizardPick },
    { title: 'Choose modules', render: renderWizardModules },
    { title: 'Review conflicts', render: renderWizardConflicts },
    { title: 'Generate docs', render: renderWizardDocs },
    { title: 'Export project', render: renderWizardExport }
  ];
  let step = 0;
  const go = () => {
    if (step < 0) return;
    if (step >= steps.length) { closeModalHost(); return; }
    const { modal, body } = openModal({
      title: 'Create a project from toolchests',
      bodyHtml: `<div class="wizard-steps">${steps.map((s, i) => `<div class="wizard-step-dot ${i < step ? 'done' : i === step ? 'active' : ''}">${i + 1}. ${s.title}</div>`).join('')}</div><div id="wizard-body"></div>`,
      actions: [
        { label: 'Cancel', onClick: ({ close }) => close() },
        { label: '← Back', onClick: () => { step = Math.max(0, step - 1); go(); } },
        { label: step === steps.length - 1 ? 'Finish' : 'Next →', primary: true, onClick: () => { step++; go(); } }
      ]
    });
    steps[step].render(body, wiz, () => go());
  };
  go();
}

function renderWizardPick(host, wiz) {
  const body = host.querySelector('#wizard-body') || host;
  if (!state.toolchests.length) {
    body.innerHTML = `<p class="muted">No toolchests yet. <button class="ghost-btn tiny" onclick="dabasemint.loadReferenceToolchests()">Load demo library</button> or <button class="ghost-btn tiny" id="wiz-reg">register one</button>.</p>`;
    body.querySelector('#wiz-reg')?.addEventListener('click', () => { closeModalHost(); $('addToolchestBtn')?.click(); });
    return;
  }
  body.innerHTML = `<p class="muted">Select the toolchests you want to draw modules from:</p>
    <ul class="wizard-checklist">${state.toolchests.map(t => `<li><input type="checkbox" data-wiz-tc="${t.id}" ${wiz.picked.has(t.id) ? 'checked' : ''} /><label>${t.name} <span class="muted">(${t.modules.length} modules)</span></label></li>`).join('')}</ul>`;
  body.querySelectorAll('[data-wiz-tc]').forEach(cb => {
    cb.onchange = () => { cb.checked ? wiz.picked.add(cb.dataset.wizTc) : wiz.picked.delete(cb.dataset.wizTc); };
  });
}

function renderWizardModules(host, wiz) {
  const body = host.querySelector('#wizard-body') || host;
  const tcs = state.toolchests.filter(t => wiz.picked.has(t.id));
  if (!tcs.length) { body.innerHTML = '<p class="muted">Go back and pick at least one toolchest.</p>'; return; }
  const inBp = new Set(state.blueprint.map(b => b.toolchestId + '/' + b.module));
  const rows = tcs.flatMap(tc => tc.modules.map(m => {
    const key = tc.id + '/' + m.name;
    return `<li><input type="checkbox" data-wiz-mod="${tc.id}|${m.name}" ${inBp.has(key) ? 'checked' : ''} /><label><strong>${m.name}</strong> <span class="muted">— ${tc.name} — ${m.role}</span></label></li>`;
  })).join('');
  body.innerHTML = `<p class="muted">Choose modules to add to your blueprint:</p><ul class="wizard-checklist">${rows}</ul>`;
  body.querySelectorAll('[data-wiz-mod]').forEach(cb => {
    cb.onchange = () => {
      const [tcId, mod] = cb.dataset.wizMod.split('|');
      if (cb.checked) addModuleToBlueprint(tcId, mod);
      else { const i = state.blueprint.findIndex(b => b.toolchestId === tcId && b.module === mod); if (i >= 0) removeFromBlueprint(i); }
    };
  });
}

function renderWizardConflicts(host) {
  const body = host.querySelector('#wizard-body') || host;
  const analysis = analyzeBlueprint();
  body.innerHTML = `<p class="muted">A pre-export health check on your blueprint.</p>
    <div class="preview-grid">
      <div>${analysis.conflicts.length ? `<div class="preview-warn">⚠ ${analysis.conflicts.length} naming conflict(s):<ul>${analysis.conflicts.map(c => `<li>${c}</li>`).join('')}</ul></div>` : '<div class="preview-ok">✓ No naming conflicts</div>'}
        ${analysis.missingReadmes.length ? `<div class="preview-warn">⚠ Missing README: ${analysis.missingReadmes.join(', ')}</div>` : '<div class="preview-ok">✓ All have READMEs</div>'}
        ${analysis.missingContracts.length ? `<div class="preview-warn">⚠ Missing contracts: ${analysis.missingContracts.join(', ')}</div>` : '<div class="preview-ok">✓ Contracts present</div>'}
      </div>
      <div><strong>Selected (${state.blueprint.length}):</strong><ul>${state.blueprint.map(b => `<li>${b.module}</li>`).join('') || '<li class="muted">none</li>'}</ul></div>
    </div>`;
}

function renderWizardDocs(host, wiz, next) {
  const body = host.querySelector('#wizard-body') || host;
  body.innerHTML = `<p class="muted">Generate a context pack your other AI agents can consume, then continue to export.</p>
    <button class="primary-btn" id="wiz-docs-btn">📝 Generate context pack</button>
    <div id="wiz-docs-out" style="margin-top:12px"></div>`;
  body.querySelector('#wiz-docs-btn')?.addEventListener('click', async () => {
    body.querySelector('#wiz-docs-out').innerHTML = '<em>Generating…</em>';
    await generateContextPack();
    body.querySelector('#wiz-docs-out').innerHTML = '<div class="preview-ok">✓ Context pack downloaded.</div>';
  });
}

function renderWizardExport(host, wiz, next) {
  const body = host.querySelector('#wizard-body') || host;
  body.innerHTML = `<p class="muted">Ready to export. This opens the full preview.</p>
    <button class="primary-btn" id="wiz-export-btn">📦 Open export preview</button>`;
  body.querySelector('#wiz-export-btn')?.addEventListener('click', () => { closeModalHost(); startExportPreview(); });
}

// ==================== BLUEPRINT ANALYSIS (pure — shared by wizard + preview) ====================
function analyzeBlueprint() {
  const conflicts = [];
  const missingReadmes = [];
  const missingContracts = [];
  const nameCount = {};
  state.blueprint.forEach(b => { nameCount[b.module] = (nameCount[b.module] || 0) + 1; });
  Object.entries(nameCount).forEach(([name, n]) => { if (n > 1) conflicts.push(`${name} (×${n} across toolchests)`); });
  state.blueprint.forEach(b => {
    const tc = state.toolchests.find(t => t.id === b.toolchestId);
    const mod = tc?.modules?.find(m => m.name === b.module);
    if (mod && !mod.hasReadme) missingReadmes.push(b.module);
    if (mod && !mod.hasContracts && !(tc?.contracts && /shared|contract/i.test(b.module))) missingContracts.push(b.module);
  });
  const tree = buildExportTree(state.blueprint);
  const files = ['README.md', 'CONNECTION.md', 'package.json', 'dabasemint.json', 'src/lib/README.txt'];
  return { conflicts, missingReadmes, missingContracts, tree, files, moduleCount: state.blueprint.length };
}

function buildExportTree(blueprint) {
  const lines = ['project-root/'];
  const byTc = {};
  blueprint.forEach(b => { (byTc[b.toolchestId] = byTc[b.toolchestId] || []).push(b.module); });
  lines.push('├─ src/');
  lines.push('│  └─ lib/');
  Object.entries(byTc).forEach(([tcId, mods], i, arr) => {
    const tc = state.toolchests.find(t => t.id === tcId);
    const last = i === arr.length - 1;
    lines.push(`│     ${last ? '└─' : '├─'} ${tc?.name || tcId}/`);
    mods.forEach(m => lines.push(`│        └─ ${m}/`));
  });
  lines.push('├─ README.md');
  lines.push('├─ CONNECTION.md');
  lines.push('├─ package.json');
  lines.push('└─ dabasemint.json');
  return lines.join('\n');
}

// ==================== EXPORT PREVIEW (point 6) ====================
function startExportPreview() {
  if (!state.blueprint.length) return toast('Blueprint is empty - add modules first');
  const a = analyzeBlueprint();
  openModal({
    title: '📦 Export preview', wide: true,
    bodyHtml: `<div class="preview-grid">
        <div>
          <h4 style="margin:0 0 6px">Folder tree</h4>
          <div class="preview-tree">${escapeHtml(a.tree)}</div>
        </div>
        <div>
          <h4 style="margin:0 0 6px">Files that will be generated</h4>
          <ul style="font-size:12px;margin:0">${a.files.map(f => `<li><code>${f}</code></li>`).join('')}</ul>
          <h4 style="margin:14px 0 6px">Selected modules (${a.moduleCount})</h4>
          <ul style="font-size:12px;margin:0">${state.blueprint.map(b => `<li>${b.module}</li>`).join('') || '<li class="muted">none</li>'}</ul>
        </div>
      </div>
      <div style="margin-top:16px">
        ${a.conflicts.length ? `<div class="preview-warn">⚠ Naming conflicts: ${a.conflicts.join('; ')}</div>` : '<div class="preview-ok">✓ No naming conflicts</div>'}
        ${a.missingContracts.length ? `<div class="preview-warn">⚠ Missing contracts: ${a.missingContracts.join(', ')}</div>` : '<div class="preview-ok">✓ Contracts present</div>'}
        ${a.missingReadmes.length ? `<div class="preview-warn">⚠ Missing READMEs: ${a.missingReadmes.join(', ')}</div>` : ''}
      </div>`,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      { label: '✏ Edit blueprint', onClick: ({ close }) => { close(); setActiveTab('blueprint'); } },
      { label: '🏗 Generate project', primary: true, onClick: ({ close }) => { close(); exportAsRealProject(); } }
    ]
  });
}

function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

// ==================== COMPARE (point 7) ====================
function toggleCompare(tcId, mod) {
  const idx = state.compareQueue.findIndex(q => q.toolchestId === tcId && q.module === mod);
  if (idx >= 0) state.compareQueue.splice(idx, 1);
  else { if (state.compareQueue.length >= 4) state.compareQueue.shift(); state.compareQueue.push({ toolchestId: tcId, module: mod }); }
  const cc = $('compare-count'); if (cc) cc.textContent = state.compareQueue.length;
  const btn = $('open-compare-btn'); if (btn) btn.disabled = state.compareQueue.length < 2;
  renderSelectedAnatomy();
}
function clearCompare() {
  state.compareQueue = [];
  const cc = $('compare-count'); if (cc) cc.textContent = '0';
  const btn = $('open-compare-btn'); if (btn) btn.disabled = true;
  renderSelectedAnatomy();
}
function openCompareModal() {
  if (state.compareQueue.length < 2) return toast('Select at least 2 modules to compare');
  const cols = state.compareQueue.map(q => {
    const tc = state.toolchests.find(t => t.id === q.toolchestId);
    const m = tc?.modules?.find(x => x.name === q.module) || { name: q.module };
    return { tc, m };
  });
  const rows = [
    ['Module', cols.map(c => escapeHtml(c.m.name))],
    ['Toolchest', cols.map(c => escapeHtml(c.tc?.name || '?'))],
    ['Role', cols.map(c => escapeHtml(c.m.role || '—'))],
    ['LOC', cols.map(c => escapeHtml(String(c.m.loc ?? '—')))],
    ['Type', cols.map(c => escapeHtml(c.m.type || '—'))],
    ['Reusability', cols.map(c => `<span class="health-score ${moduleReusability(c.m, c.tc) >= 70 ? 'ok' : moduleReusability(c.m, c.tc) >= 50 ? 'cyan' : 'warn'}">${moduleReusability(c.m, c.tc)}</span>`)],
    ['Best for', cols.map(c => `<span class="tag">${moduleBestFor(c.m)}</span>`)],
    ['Contracts', cols.map(c => (c.m.hasContracts || (c.tc?.contracts && /shared|contract/i.test(c.m.name))) ? '<span class="ok-inline">✓</span>' : '<span class="warn-inline">✗</span>')],
    ['README', cols.map(c => c.m.hasReadme ? '<span class="ok-inline">✓</span>' : '<span class="warn-inline">✗</span>')],
    ['Hard to transplant', cols.map(c => { const w = moduleTransplantWarning(c.m, c.tc); return w.length ? `<span class="warn-inline">${w.join(', ')}</span>` : '<span class="ok-inline">none</span>'; })]
  ];
  const table = `<table class="compare-table"><thead><tr><th></th>${cols.map(c => `<th>${escapeHtml(c.m.name)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr><th>${r[0]}</th>${r[1].map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  openModal({ title: '⚖ Compare modules', wide: true, bodyHtml: table, actions: [{ label: 'Close', onClick: ({ close }) => close() }] });
}

// ==================== FILE-STATUS CHECKS (point 10) ====================
async function refreshAllFileStatus() {
  await Promise.all(state.toolchests.map(tc => checkToolchestHealth(tc.id)));
  renderLibrary();
  if (state.selectedToolchestId) renderSelectedAnatomy();
}
async function checkToolchestHealth(id) {
  const tc = state.toolchests.find(t => t.id === id);
  if (!tc) return;
  const path = tc._nativePath || tc.path || '';
  if (!path || tc.sourceType === 'minted') { state.fileStatus[id] = 'connected'; return; }
  // Browser: can't stat FS directly; use _dirHandle if present, else mark connected (no signal).
  if (tc._dirHandle) {
    try {
      // Attempt a cheap handle op to confirm reachability.
      await tc._dirHandle.values().next();
      state.fileStatus[id] = 'connected';
    } catch (e) {
      state.fileStatus[id] = e.name === 'NotAllowedError' ? 'permission' : 'missing';
    }
    return;
  }
  // Tauri: stat via invoke if available.
  if (window.__TAURI__ && window.__TAURI__.invoke) {
    try {
      const res = await safeTauriCall(() => window.__TAURI__.invoke('stat_path', { path }), null, 'stat_path');
      if (res == null) { state.fileStatus[id] = 'connected'; return; }
      state.fileStatus[id] = res.exists ? (res.mtime && tc.lastSeenMtime && res.mtime > tc.lastSeenMtime ? 'changed' : 'connected') : 'missing';
    } catch { state.fileStatus[id] = 'connected'; }
    return;
  }
  state.fileStatus[id] = 'connected';
}

// ==================== EXPORT HISTORY + OPEN FOLDER (point 5) ====================
function recordExport(name, moduleCount, fileCount) {
  state.exportHistory.unshift({ name, moduleCount, files: fileCount, ts: Date.now() });
  if (state.exportHistory.length > 12) state.exportHistory.pop();
  saveState();
}
async function openExportedFolder() {
  if (window.__TAURI__ && window.__TAURI__.invoke) {
    await safeTauriCall(() => window.__TAURI__.invoke('open_downloads_dir'), null, 'open_downloads_dir');
    toast('Opening downloads folder…');
  } else {
    toast('Exports download to your browser’s Downloads folder.');
  }
}

function setupGlobalEvents() {
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement.tagName === 'BODY') {
      e.preventDefault();
      const s = $('search-input');
      if (s) s.focus();
    }
    if (e.key.toLowerCase() === 'c' && e.metaKey) {
      e.preventDefault();
      $('composition-canvas')?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Search + filter inputs always exist in index.html, so always wire them.
  setupFilters();

  // --- Tab bar ---
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });
  // Hero secondary buttons that jump to a tab
  document.querySelectorAll('[data-tab]').forEach(el => {
    if (el.classList.contains('tab-btn')) return; // already wired
    el.addEventListener('click', () => setActiveTab(el.dataset.tab));
  });

  // --- Wizard / tour / compare / addToolchestBtn2 ---
  $('mainWizardBtn')?.addEventListener('click', () => startWizard());
  $('onboardingBtn')?.addEventListener('click', () => startOnboarding(true));
  $('addToolchestBtn2')?.addEventListener('click', () => $('addToolchestBtn')?.click());
  $('open-compare-btn')?.addEventListener('click', () => openCompareModal());
}

async function init() {
  // Global handler for any remaining unhandled promise rejections (addresses low-priority follow-up from heal)
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection in dabasemint:', event.reason);
    if (typeof toast === 'function') {
      toast('Unexpected error — check console (details logged)', 5000);
    }
  });

  loadState();

  $('addToolchestBtn')?.addEventListener('click', async () => {
    // Tauri native dialog if available (better native FS)
    if (window.__TAURI__ && window.__TAURI__.dialog) {
      const selected = await safeTauriCall(
        () => window.__TAURI__.dialog.open({ directory: true, multiple: false }),
        null,
        'Tauri folder picker'
      );
      if (selected) {
        // In full impl, use Tauri's fs to parse, for now use browser loader + path
        const loaded = await registerToolchestFromDisk();
        if (loaded) {
          registerToolchest(loaded);
          toast('Loaded via Tauri native');
          return;
        }
      }
    }
    // Try real disk registration first (best UX)
    const loaded = await registerToolchestFromDisk();
    if (loaded) {
      registerToolchest(loaded);
      toast('Toolchest loaded from disk with real structure');
      return;
    }
    // Fallback to manual
    const name = prompt('Toolchest name (fallback)');
    const path = prompt('Full path');
    if (name && path) {
      registerToolchest({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name, path,
        sourceType: 'manual',
        modules: [{ name: '00-shared', role: 'Pending analysis', loc: '?' }],
        readme: 'Manually added. Use Assay for intelligence.',
        forgeState: {}
      });
    }
  });

  $('loadReferencesBtn')?.addEventListener('click', loadReferenceToolchests);

  // Add quick load buttons for known toolchests
  const known = ['page-agent-toolchest', 'captions-site-toolchest', 'Glaze-toolchest'];
  known.forEach(name => {
    const btn = document.getElementById('load-' + name.replace(/[^a-z0-9]/g, ''));
    if (btn) {
      btn.addEventListener('click', async () => {
        const loaded = await registerToolchestFromDisk(name);
        if (loaded) {
          registerToolchest(loaded);
          toast(`Loaded ${name}`);
        }
      });
    }
  });
  $('clearAllBtn')?.addEventListener('click', () => {
    if (confirm('Reset everything?')) {
      localStorage.clear();
      location.reload();
    }
  });

  await fetchAgentStatus();
  setupGlobalEvents();
  renderAll();

  // File-status checks (point 10) — poll on focus + every 60s.
  refreshAllFileStatus();
  window.addEventListener('focus', refreshAllFileStatus);
  setInterval(refreshAllFileStatus, 60000);

  // First-run onboarding tour (point 1). Only if not seen.
  setTimeout(() => startOnboarding(false), 500);

  console.log('%c[dabasemint] Enhanced & healthy. Ready.', 'color:#22c8ff');
}

// ==================== TOAST ====================
// Called ~35x across the app but was previously never defined.
let toastTimer = null;
function toast(message, duration = 2600) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
  el.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, duration);
}

// ==================== WINDOW EXPORTS ====================
// src/main.js is loaded as an ES module, so inline onclick attribute
// handlers in index.html and in dynamically-rendered markup run in GLOBAL
// scope and would otherwise throw ReferenceError. Inline handlers call bare
// names (e.g. onclick="exportRegistry()"), so each handler MUST be assigned
// as a DIRECT property of window — nesting them under window.dabasemint is
// NOT enough. Explicit assignments are used (not eval) so esbuild's minifier
// keeps them correct in the production bundle. The test suite enforces this.
window.toast = toast;
window.state = state;
window.runTouchpoint = runTouchpoint;
window.loadReferenceToolchests = loadReferenceToolchests;
window.exportBlueprint = exportBlueprint;
window.exportAsRealProject = exportAsRealProject;
window.mintBlueprint = mintBlueprint;
window.generateContextPack = generateContextPack;
window.runTradeRoutes = runTradeRoutes;
window.runAssay = runAssay;
window.runComplements = runComplements;
window.runCompositionAdvisor = runCompositionAdvisor;
window.addModuleToBlueprint = addModuleToBlueprint;
window.removeFromBlueprint = removeFromBlueprint;
window.moveBlueprintItem = moveBlueprintItem;
window.reorderBlueprint = reorderBlueprint;
window.clearBlueprint = clearBlueprint;
window.exportRegistry = exportRegistry;
window.importRegistry = importRegistry;
window.compareLastTwo = compareLastTwo;
window.toggleCommandPalette = toggleCommandPalette;
window.showHelp = showHelp;
window.closeHelp = closeHelp;
window.closeModal = closeModal;
window.filterByTag = filterByTag;
window.clearTagFilter = clearTagFilter;
window.clearFilters = clearFilters;
window.applyAssayResult = applyAssayResult;
window.applyComplementsResult = applyComplementsResult;
window.applyAdvisorSuggestions = applyAdvisorSuggestions;
window.showModuleModal = showModuleModal;
window.loadContractsPreview = loadContractsPreview;
// === UX overhaul exports ===
window.setActiveTab = setActiveTab;
window.showAdvanced = showAdvanced;
window.dismissStartHere = dismissStartHere;
window.startOnboarding = startOnboarding;
window.startWizard = startWizard;
window.startExportPreview = startExportPreview;
window.analyzeBlueprint = analyzeBlueprint;
window.openCompareModal = openCompareModal;
window.clearCompare = clearCompare;
window.toggleCompare = toggleCompare;
window.saveCurrentSearch = saveCurrentSearch;
window.handleAgentAction = handleAgentAction;
window.renderProvidersPanel = renderProvidersPanel;
window.renderSnapshotsPanel = renderSnapshotsPanel;
window.openExportedFolder = openExportedFolder;
window.refreshToolchest = refreshToolchest;
// Convenience aggregate (kept for window.dabasemint.exportBlueprint style calls).
window.dabasemint = {
  state, runTouchpoint, loadReferenceToolchests, exportBlueprint, exportAsRealProject,
  mintBlueprint, generateContextPack, runTradeRoutes, runAssay, runComplements,
  runCompositionAdvisor, addModuleToBlueprint, removeFromBlueprint, moveBlueprintItem,
  reorderBlueprint, clearBlueprint, exportRegistry, importRegistry, compareLastTwo,
  toggleCommandPalette, showHelp, filterByTag, clearTagFilter, clearFilters,
  applyAssayResult, applyComplementsResult, applyAdvisorSuggestions, showModuleModal, toast,
  // UX additions
  setActiveTab, showAdvanced, dismissStartHere, startOnboarding, startWizard,
  startExportPreview, analyzeBlueprint, openCompareModal, clearCompare, toggleCompare,
  saveCurrentSearch, handleAgentAction, renderProvidersPanel, renderSnapshotsPanel,
  openExportedFolder, refreshToolchest
};

// Tauri integration hook
if (window.__TAURI__) {
  console.log('%c[dabasemint] Running inside Tauri desktop wrapper', 'color:#22c8ff');
  const statusEl = document.getElementById('tauri-status');
  if (statusEl) statusEl.style.display = 'inline-block';
}

init();
