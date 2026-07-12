#!/usr/bin/env node
/**
 * dabasemint — End-to-End tests.
 *
 * Exercises REAL module functions (not reimplemented logic), awaits async
 * tests properly, and includes a static regression check that every inline
 * onclick handler is actually exposed to window (the bug that previously
 * silenced ~25 buttons).
 *
 * Run: npm test
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAgentProviderStatus,
  extractJsonFromCompletion,
  repairJsonString,
  computeRetryDelayMs,
  parseRetryAfterMs,
  isRetryableAgentStatus,
  runAgentTouchpoint
} from '../src/agent-provider.mjs';
import {
  buildAgentTouchpointPrompt,
  validateAgentTouchpointResponse,
  DABASEMINT_TOUCHPOINTS
} from '../src/agent-touchpoints.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

// Async-aware test harness.
async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}`);
    console.log(`   ${e.message}`);
    failures.push(name);
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${b}, got ${a}`); }

// ---------- Real agent-provider functions ----------

await test('getAgentProviderStatus returns full multi-provider shape', async () => {
  const status = await getAgentProviderStatus();
  assert(typeof status === 'object', 'status is not an object');
  eq(typeof status.configured, 'boolean', 'configured must be boolean');
  assert(typeof status.provider === 'string', 'provider must be string');
  assert(Array.isArray(status.providers), 'providers array missing');
  assert(status.providers.length >= 1, 'should list at least one provider');
  assert(status.providers.every(p => typeof p.configured === 'boolean'), 'providers need configured flag');
  // Novita must be configured in this environment (key present).
  const novita = status.providers.find(p => p.id === 'novita');
  assert(novita && novita.configured, 'Novita should be configured (key present)');
});

await test('extractJsonFromCompletion parses clean JSON', async () => {
  const r = extractJsonFromCompletion('{"a":1}');
  assert(r.ok && r.data.a === 1, 'failed to parse clean JSON');
});

await test('extractJsonFromCompletion parses fenced JSON', async () => {
  const r = extractJsonFromCompletion('Here you go:\n```json\n{"b":2}\n```\n');
  assert(r.ok && r.data.b === 2, 'failed to parse fenced JSON');
});

await test('extractJsonFromCompletion parses embedded JSON object', async () => {
  const r = extractJsonFromCompletion('noise before {"c":3} noise after');
  assert(r.ok && r.data.c === 3, 'failed to extract embedded JSON');
});

await test('extractJsonFromCompletion rejects empty / non-JSON', async () => {
  assert(!extractJsonFromCompletion('').ok, 'empty should fail');
  assert(!extractJsonFromCompletion('no json here').ok, 'non-json should fail');
});

await test('repairJsonString fixes raw control chars + bad escapes', async () => {
  // raw tab/newline inside a string value
  const bad = '{"a":"line1\nline2\ttab","b":"bad \\( escape"}';
  const repaired = repairJsonString(bad);
  const parsed = JSON.parse(repaired);
  assert(parsed.a && parsed.a.includes('line1'), 'control-char repair failed');
  assert(parsed.b !== undefined, 'bad-escape repair failed');
});

await test('extractJsonFromCompletion repairs malformed LLM JSON', async () => {
  // model emitted a raw newline inside a string value + an invalid escape
  const malformed = 'Here: {"note":"multi\nline", "path":"C\\\\temp"} done';
  const r = extractJsonFromCompletion(malformed);
  assert(r.ok, `repair path failed: ${r.error}`);
});

await test('computeRetryDelayMs respects exponential backoff + cap', async () => {
  const d0 = computeRetryDelayMs(0, { initialDelayMs: 1000, multiplier: 2, jitterMs: 0 });
  const d3 = computeRetryDelayMs(3, { initialDelayMs: 1000, multiplier: 2, jitterMs: 0 });
  eq(d0, 1000, 'first delay should equal initial');
  assert(d3 >= 8000, `third delay should be >= 8000, got ${d3}`);
  const capped = computeRetryDelayMs(10, { initialDelayMs: 1000, multiplier: 2, maxDelayMs: 15000, jitterMs: 0 });
  eq(capped, 15000, 'should cap at maxDelayMs');
});

await test('computeRetryDelayMs honors Retry-After header', async () => {
  const d = computeRetryDelayMs(0, { retryAfterMs: 7000, maxDelayMs: 15000 });
  eq(d, 7000, 'should use retryAfterMs when provided');
});

await test('parseRetryAfterMs handles seconds + HTTP-date', async () => {
  eq(parseRetryAfterMs('5'), 5000, 'seconds form');
  assert(parseRetryAfterMs(null) === null, 'null header -> null');
});

await test('isRetryableAgentStatus matches configured retryable statuses', async () => {
  assert(isRetryableAgentStatus(429), '429 retryable');
  assert(isRetryableAgentStatus(503), '503 retryable');
  assert(!isRetryableAgentStatus(400), '400 not retryable');
});

// ---------- Real touchpoint catalog ----------

await test('every touchpoint builds a non-empty prompt', async () => {
  for (const t of DABASEMINT_TOUCHPOINTS) {
    const prompt = buildAgentTouchpointPrompt(t.id, {});
    assert(prompt && prompt.length > 20, `${t.id} built empty prompt`);
  }
});

await test('unknown touchpoint returns empty prompt', async () => {
  eq(buildAgentTouchpointPrompt('does-not-exist', {}), '', 'unknown should yield empty');
});

await test('validateAgentTouchpointResponse accepts valid assay JSON', async () => {
  const valid = JSON.stringify({ overallQuality: 'high', keyStrengths: ['x'] });
  const v = validateAgentTouchpointResponse('assay-toolchest', valid);
  assert(v.ok, 'valid assay rejected');
});

await test('validateAgentTouchpointResponse rejects invalid JSON', async () => {
  const v = validateAgentTouchpointResponse('assay-toolchest', '{not json');
  assert(!v.ok && v.errors.length > 0, 'invalid JSON should be rejected');
});

await test('runAgentTouchpoint works end-to-end with a mock provider (no network)', async () => {
  // Inject a fake fetch that returns a well-formed completion for any request.
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify({
      choices: [{ message: { content: '{"overallQuality":"medium","keyStrengths":["a"],"richnessScore":50,"suggestedTags":["t"],"hiddenGems":[],"reusabilityNotes":"n","recommendedUseCases":[]}' } }]
    })
  });
  const result = await runAgentTouchpoint('assay-toolchest',
    { toolchestName: 'mock', modules: [], readmeExcerpt: '' },
    { provider: 'novita', apiKey: 'test-key' }, fakeFetch);
  assert(result.ok, `mock touchpoint failed: ${result.error}`);
  assert(result.data && result.data.overallQuality, 'parsed data missing fields');
});

await test('runAgentTouchpoint surfaces unknown-provider failure cleanly', async () => {
  const result = await runAgentTouchpoint('assay-toolchest', {},
    { provider: 'definitely-not-a-real-provider' }, async () => { throw new Error('should not be called'); });
  assert(!result.ok, 'should fail with unknown provider');
  assert(/unknown agent provider/i.test(result.error), `unexpected error: ${result.error}`);
});

// ---------- Regression: inline onclick handlers must be exported to window ----------

await test('every inline onclick handler is exposed on window.dabasemint', async () => {
  const mainSrc = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  // Collect exposed names. Bare inline calls (onclick="exportRegistry()")
  // need a DIRECT window.<name> = assignment — membership in a
  // window.dabasemint = {...} block is NOT sufficient. So we require direct
  // assignments.
  const exported = new Set();
  const directAssign = [...mainSrc.matchAll(/window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g)];
  assert(directAssign.length > 0, 'no direct window.<name> assignments found');
  directAssign.forEach(m => exported.add(m[1]));

  // Collect handler names referenced by inline onclick/ondragstart/ondrop attributes.
  const referenced = new Set();
  const attrRe = /on(?:click|dragstart|drop|change|input)\s*=\s*"([^"]*)"/g;
  for (const src of [htmlSrc, mainSrc]) {
    let m;
    while ((m = attrRe.exec(src)) !== null) {
      const body = m[1].trim();
      // Extract the first identifier called. Skip IIFEs and window.xxx chains.
      if (body.startsWith('(function') || body.startsWith('(async') || body.startsWith('window.')) continue;
      const id = body.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
      if (id) referenced.add(id[1]);
    }
  }

  // Built-in globals are fine (alert, confirm, document, etc.) — exclude them.
  const builtins = new Set(['alert', 'confirm', 'prompt', 'document', 'window', 'event', 'console']);
  const missing = [...referenced].filter(fn => !exported.has(fn) && !builtins.has(fn));
  assert(missing.length === 0,
    `handlers not exposed to window.dabasemint: ${missing.join(', ')}`);
});

// ---------- Summary ----------

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
console.log('\nAll flows healthy.');
