#!/usr/bin/env node
/**
 * dabasemint CLI — terminal companion to the visual workshop.
 *
 * Commands:
 *   list                       List registered toolchests
 *   register <path> [--name N] Scan a /forge toolchest folder and add it
 *   assay <id|path>            Run an AI assay on a toolchest
 *   rm <id>                    Remove a toolchest from the registry
 *   status                     Show AI provider configuration
 *   serve                      Start the web workshop (npm run serve)
 *   help                       Show this help
 *
 * The registry lives at ~/.dabasemint/registry.json so it can be managed
 * from the terminal. The web app uses localStorage by default; import this
 * registry file via the "Import Registry" button to sync.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { getAgentProviderStatus, runAgentTouchpoint } from '../src/agent-provider.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REGISTRY_DIR = path.join(os.homedir(), '.dabasemint');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'registry.json');

const args = process.argv.slice(2);
const command = args[0] || 'help';

// ---------- helpers ----------

function ensureRegistry() {
  if (!fs.existsSync(REGISTRY_DIR)) fs.mkdirSync(REGISTRY_DIR, { recursive: true });
  if (!fs.existsSync(REGISTRY_FILE)) fs.writeFileSync(REGISTRY_FILE, '[]');
}

function readRegistry() {
  ensureRegistry();
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeRegistry(data) {
  ensureRegistry();
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2));
}

function detectSourceType(name) {
  const n = name.toLowerCase();
  if (n.includes('page-agent')) return 'oss-repo';
  if (n.includes('captions') || n.includes('site')) return 'production-web';
  if (n.includes('glaze') || n.includes('app')) return 'native-binary';
  return 'unknown';
}

// Native disk scan (mirrors read_toolchest_native in the Tauri layer).
async function scanToolchest(folderPath) {
  const base = path.resolve(folderPath);
  const stat = await fsp.stat(base).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Not a directory: ${base}`);
  }
  const name = path.basename(base);

  const result = {
    id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    name,
    path: base,
    sourceType: detectSourceType(name),
    modules: [],
    readme: '',
    contracts: false,
    hasForgeState: false
  };

  // README
  const readme = await fsp.readFile(path.join(base, 'README.md'), 'utf8').catch(() => null);
  if (readme) result.readme = readme.slice(0, 1200);

  // .forge-state.md
  const forgeState = await fsp.readFile(path.join(base, '.forge-state.md'), 'utf8').catch(() => null);
  if (forgeState) { result.hasForgeState = true; result.forgeState = { raw_preview: forgeState.slice(0, 400) }; }

  // numbered modules
  const entries = await fsp.readdir(base, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && /^\d{2}-/.test(entry.name)) {
      const modPath = path.join(base, entry.name);
      let role = 'Module from toolchest';
      let loc = '?';
      let hasReadme = false;
      let hasContracts = false;
      const modReadme = await fsp.readFile(path.join(modPath, 'README.md'), 'utf8').catch(() => null);
      if (modReadme) {
        hasReadme = true;
        loc = String(Math.round(modReadme.length / 10));
        const m = modReadme.split('\n').slice(0, 5).join(' ').match(/(?:^|\n)([A-Z][^.!?]{20,80})/);
        if (m) role = m[1].trim().slice(0, 70);
      }
      if (entry.name === '00-shared') {
        const c = await fsp.readFile(path.join(modPath, 'contracts.md')).catch(() => null);
        if (c) hasContracts = true;
      }
      result.modules.push({ name: entry.name, role, loc, type: entry.name.includes('shared') ? 'shared' : 'module', hasReadme, hasContracts });
    }
  }
  result.modules.sort((a, b) => a.name.localeCompare(b.name));
  if (result.hasForgeState && result.forgeState?.raw_preview?.includes('github')) result.sourceType = 'oss-repo';

  // contracts at top level
  await fsp.readFile(path.join(base, '00-shared', 'contracts.md')).then(() => { result.contracts = true; }).catch(() => {});

  return result;
}

// ---------- commands ----------

async function cmdList() {
  const reg = readRegistry();
  if (!reg.length) {
    console.log('No toolchests registered. Try: dabasemint register /path/to/toolchest');
    return;
  }
  console.log(`\n  ${reg.length} toolchest(s) in ${REGISTRY_FILE}\n`);
  for (const tc of reg) {
    const mods = tc.modules?.length || 0;
    console.log(`  ${tc.id}`);
    console.log(`    ${tc.path}`);
    console.log(`    ${tc.sourceType} • ${mods} modules • contracts: ${tc.contracts ? 'yes' : 'no'}\n`);
  }
}

async function cmdRegister(rawArgs) {
  const target = rawArgs.find(a => !a.startsWith('--'));
  const nameArg = rawArgs.find(a => a.startsWith('--name'));
  if (!target) {
    console.error('Usage: dabasemint register <path> [--name name]');
    process.exit(1);
  }
  const scanned = await scanToolchest(target);
  if (nameArg) {
    const name = nameArg.split('=')[1] || nameArg.replace('--name', '').trim();
    if (name) { scanned.name = name; scanned.id = name.toLowerCase().replace(/[^a-z0-9]/g, '-'); }
  }
  scanned.addedAt = Date.now();

  const reg = readRegistry();
  const idx = reg.findIndex(t => t.id === scanned.id);
  if (idx >= 0) { reg[idx] = scanned; console.log(`Updated "${scanned.name}"`); }
  else { reg.push(scanned); console.log(`Registered "${scanned.name}" (${scanned.modules.length} modules)`); }
  writeRegistry(reg);
}

async function cmdRm(rawArgs) {
  const id = rawArgs.find(a => !a.startsWith('--'));
  if (!id) { console.error('Usage: dabasemint rm <id>'); process.exit(1); }
  let reg = readRegistry();
  const before = reg.length;
  reg = reg.filter(t => t.id !== id);
  if (reg.length === before) { console.error(`No toolchest with id "${id}"`); process.exit(1); }
  writeRegistry(reg);
  console.log(`Removed "${id}"`);
}

async function cmdAssay(rawArgs) {
  const ref = rawArgs.find(a => !a.startsWith('--'));
  if (!ref) { console.error('Usage: dabasemint assay <id|path>'); process.exit(1); }

  let toolchest;
  const reg = readRegistry();
  const found = reg.find(t => t.id === ref);
  if (found) {
    toolchest = found;
  } else if (fs.existsSync(ref)) {
    console.log(`Scanning "${ref}"...`);
    toolchest = await scanToolchest(ref);
  } else {
    console.error(`Not a registered id or a valid path: ${ref}`);
    process.exit(1);
  }

  console.log(`Assaying "${toolchest.name}" via the agent layer...`);
  const result = await runAgentTouchpoint('assay-toolchest', {
    toolchestName: toolchest.name,
    modules: toolchest.modules,
    forgeState: toolchest.forgeState || {},
    readmeExcerpt: toolchest.readme || ''
  });

  if (!result.ok) {
    console.error(`\nAssay failed: ${result.error}`);
    process.exit(1);
  }
  console.log('\n' + JSON.stringify(result.data, null, 2));
  console.log(`\n(provider: ${result.provider} • model: ${result.model})`);
}

async function cmdStatus() {
  const status = await getAgentProviderStatus();
  console.log(`\nAgent provider: ${status.provider}`);
  console.log(`Configured: ${status.configured ? 'yes' : 'no'}`);
  console.log(`Model: ${status.model}`);
  if (status.authSource) console.log(`Auth source: ${status.authSource}`);
  console.log('\nProviders:');
  for (const p of status.providers || []) {
    console.log(`  ${p.configured ? '✅' : '⚠️ '} ${p.id} — ${p.name} (${p.configured ? 'key set' : 'no key'})`);
  }
  console.log('');
}

function cmdServe() {
  console.log('Starting dabasemint web workshop...');
  const child = spawn('node', [path.join(ROOT, 'scripts/serve.mjs')], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code || 0));
}

function cmdHelp() {
  console.log(`
  dabasemint — toolchest visual intelligence + agentic workshop (CLI)

  Usage:
    dabasemint list                       List registered toolchests
    dabasemint register <path> [--name N] Scan a /forge toolchest and register it
    dabasemint assay <id|path>            Run an AI assay on a toolchest
    dabasemint rm <id>                    Remove a toolchest from the registry
    dabasemint status                     Show AI provider configuration
    dabasemint serve                      Start the web workshop (http://localhost:4174)
    dabasemint help                       Show this help

  Registry: ${REGISTRY_FILE}
  `);
}

// ---------- dispatch ----------

(async () => {
  const rest = args.slice(1);
  try {
    switch (command) {
      case 'list': case 'ls': await cmdList(); break;
      case 'register': case 'add': await cmdRegister(rest); break;
      case 'rm': case 'remove': await cmdRm(rest); break;
      case 'assay': await cmdAssay(rest); break;
      case 'status': await cmdStatus(); break;
      case 'serve': cmdServe(); break;
      case 'help': case '--help': case '-h': cmdHelp(); break;
      default:
        console.error(`Unknown command: ${command}\n`);
        cmdHelp();
        process.exit(1);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
})();
