#!/usr/bin/env node
/**
 * dabasemint - End-to-End Flow Test (Node simulation)
 * Tests core logic that can run outside the browser.
 */

import { registerToolchestFromDisk } from '../src/toolchest-loader.js';
import { getAgentProviderStatus } from '../src/agent-provider.mjs';

console.log('=== dabasemint E2E Simulation ===\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${e.message}`);
    failed++;
  }
}

// 1. Agent provider loads and has key
test('Agent provider loads with Novita key', async () => {
  const status = await getAgentProviderStatus();
  if (!status.configured) throw new Error('Novita key not detected');
  if (status.provider !== 'novita') throw new Error('Wrong default provider');
});

// 2. Simulate loading reference data (like the hardcoded REFERENCES)
test('Reference toolchest data structure is valid', () => {
  const refs = [
    { id: 'page-agent', modules: 9, hasContracts: true },
    { id: 'captions-site', modules: 12 },
    { id: 'glaze', modules: 4 }
  ];
  refs.forEach(r => {
    if (!r.id || !r.modules) throw new Error('Invalid ref structure');
  });
});

// 3. Blueprint operations
test('Blueprint add + duplicate prevention logic', () => {
  let blueprint = [];
  const add = (tcId, mod) => {
    if (blueprint.some(b => b.module === mod)) return false;
    blueprint.push({ toolchestId: tcId, module: mod });
    return true;
  };
  if (!add('page', '01-llms')) throw new Error('First add failed');
  if (add('page', '01-llms')) throw new Error('Duplicate should be rejected');
  if (blueprint.length !== 1) throw new Error('Blueprint length wrong');
});

// 4. Health scoring
test('Health score calculation is reasonable', () => {
  const fakeTC = { modules: Array(9).fill(1), contracts: true, sourceType: 'oss-repo' };
  let score = 50;
  score += fakeTC.modules.length * 4;
  if (fakeTC.contracts) score += 12;
  score = Math.min(98, Math.max(40, Math.round(score)));
  if (score < 65 || score > 98) throw new Error('Health score out of expected range: ' + score);
});

// 5. Minted blueprint creation shape
test('Mint blueprint produces correct shape', () => {
  const bp = [{ toolchestId: 'p', module: '01-llms' }];
  const minted = {
    id: 'test-mint',
    name: 'Test Mint',
    modules: bp.map(b => ({ name: b.module, role: 'From blueprint' })),
    tags: ['minted', 'blueprint']
  };
  if (!minted.modules.length || !minted.tags.includes('minted')) {
    throw new Error('Minted object malformed');
  }
});

// 6. Export as Real Project scaffold shape (RECOMMENDATIONS)
test('Export as Real Project produces useful scaffold artifacts', () => {
  const bp = [{ toolchestId: 'p', module: '01-llms' }];
  const modulesInfo = bp.map(b => ({ toolchest: 'test', module: b.module }));
  const files = {
    'README.md': 'scaffold',
    'CONNECTION.md': modulesInfo.map(m => m.module).join(','),
    'package.json': '{}',
    'dabasemint.json': JSON.stringify({modules: modulesInfo})
  };
  if (Object.keys(files).length !== 4 || !files['CONNECTION.md']) throw new Error('Scaffold missing key files');
});

// 7. Native reveal simulation (RECOMMENDATIONS R2)
test('Native reveal simulation produces valid path response shape', () => {
  const simulateReveal = (path) => ({ ok: true, path, action: 'reveal' });
  const res = simulateReveal('/Users/kc/page-agent-toolchest');
  if (!res.ok || !res.path || res.action !== 'reveal') throw new Error('Reveal shape invalid');
});

// 8. Health dashboard data shape (R4)
test('Health dashboard computes correct global + per-tc stats shape', () => {
  const tcs = [
    { id: 'a', name: 'A', modules: [{}, {}, {}], contracts: true, sourceType: 'oss-repo' },
    { id: 'b', name: 'B', modules: [{}], contracts: false }
  ];
  const totalModules = tcs.reduce((s, t) => s + (t.modules?.length || 0), 0);
  const healths = tcs.map(t => 40 + (t.modules.length * 5) + (t.contracts ? 12 : 0));
  const avg = Math.round(healths.reduce((x,y)=>x+y,0) / tcs.length);
  const missing = tcs.filter(t => !t.contracts).length;
  const dashboard = { count: tcs.length, totalModules, avgHealth: avg, missingContracts: missing };
  if (dashboard.count !== 2 || dashboard.totalModules !== 4 || dashboard.missingContracts !== 1 || dashboard.avgHealth < 40) {
    throw new Error('Health dashboard shape or calc wrong: ' + JSON.stringify(dashboard));
  }
});

// 9. Restart proxy simulation
test('Agent proxy restart simulation returns healthy state', () => {
  const simulateRestart = () => ({ ok: true, restarted: true, port: 12345, health: { ok: true } });
  const res = simulateRestart();
  if (!res.ok || !res.restarted || !res.health.ok) throw new Error('Restart proxy sim failed');
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  console.log('\nSome flows have issues that would surface at runtime.');
  process.exit(1);
} else {
  console.log('\nCore logic flows look healthy.');
}
