#!/usr/bin/env node
/**
 * dabasemint pre-flight health checks.
 * Verifies files exist AND structural correctness (window exports,
 * complete touchpoint prompts, config presence). Run before serve/build.
 */

import fs from 'node:fs';
import { getAgentProviderStatus } from '../src/agent-provider.mjs';
import { DABASEMINT_TOUCHPOINTS, buildAgentTouchpointPrompt } from '../src/agent-touchpoints.mjs';

const checks = [];

function file(p) { return fs.existsSync(p); }
function read(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; }

// --- files present ---
checks.push(['Agent provider loads', !!(await getAgentProviderStatus())]);
checks.push(['config/agent.local.json present', file('./config/agent.local.json')]);
checks.push(['Main app code present', file('./src/main.js') && fs.statSync('./src/main.js').size > 18000]);
checks.push(['Stylesheet present', file('./src/styles.css')]);
checks.push(['Agent touchpoints present', file('./src/agent-touchpoints.mjs')]);
checks.push(['Agent proxy present', file('./agent-proxy.mjs')]);
checks.push(['CLI present', file('./bin/dabasemint.mjs')]);
checks.push(['Serve script has agent routes', read('./scripts/serve.mjs').includes('/api/agent')]);

// --- structural: every touchpoint has a non-empty prompt (regression guard) ---
const emptyPrompts = DABASEMINT_TOUCHPOINTS
  .filter(t => !buildAgentTouchpointPrompt(t.id, {}) || buildAgentTouchpointPrompt(t.id, {}).length < 20)
  .map(t => t.id);
checks.push([`All ${DABASEMINT_TOUCHPOINTS.length} touchpoints have prompts`, emptyPrompts.length === 0]);

// --- structural: critical handlers exposed as DIRECT globals (regression guard) ---
const mainSrc = read('./src/main.js');
checks.push(['window.dabasemint export block present', /window\.dabasemint\s*=\s*\{/.test(mainSrc)]);
checks.push(['toast() is defined', /function toast\s*\(/.test(mainSrc) || /const toast\s*=/.test(mainSrc)]);
checks.push(['critical handlers exposed as direct window globals',
  ['exportRegistry', 'importRegistry', 'compareLastTwo', 'runTradeRoutes', 'toggleCommandPalette', 'toast', 'mintBlueprint', 'exportAsRealProject']
    .every(fn => new RegExp(`window\\.${fn}\\s*=`).test(mainSrc))
]);

// --- structural: agent-proxy.mjs is pure ESM (no require()) ---
const proxySrc = read('./agent-proxy.mjs');
checks.push(['agent-proxy.mjs has no require() (ESM-safe)', !/\brequire\s*\(/.test(proxySrc)]);

// --- config has a usable key (Novita) ---
const status = await getAgentProviderStatus();
checks.push(['At least one provider configured', !!status.configured]);

console.log('=== dabasemint Health & UX Verification ===\n');
console.table(checks.map(([name, pass]) => ({ Check: name, Status: pass ? '✅ PASS' : '❌ FAIL' })));

const failures = checks.filter(c => !c[1]).map(c => c[0]);
const allPass = failures.length === 0;
if (allPass) {
  console.log('\n✅ Project is healthy and ready for heavy use.');
} else {
  console.log('\n⚠️ Some checks failed:');
  failures.forEach(f => console.log('   - ' + f));
}
console.log('\nRun: npm run serve   (or)   node bin/dabasemint.mjs serve');

if (!allPass) process.exit(1);
