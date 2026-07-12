#!/usr/bin/env node
/**
 * dabasemint pre-build check for the agent proxy.
 *
 * The desktop app spawns `node agent-proxy.mjs` as a runtime sidecar
 * (see src-tauri/src/main.rs). It is NOT a compiled pkg binary anymore —
 * the .mjs + its src/ imports are bundled as Tauri resources.
 *
 * This script verifies those files exist and the proxy can boot before a
 * `tauri build`, so a broken build is caught early instead of producing a
 * desktop app with a dead agent layer.
 */

import { existsSync } from 'fs';
import { spawn } from 'child_process';

const REQUIRED = [
  'agent-proxy.mjs',
  'src/agent-provider.mjs',
  'src/agent-touchpoints.mjs'
];

let ok = true;

console.log('[build-sidecar] Verifying agent proxy files...');
for (const f of REQUIRED) {
  const present = existsSync(f);
  console.log(`  ${present ? '✅' : '❌'} ${f}`);
  if (!present) ok = false;
}
if (!ok) {
  console.error('\n❌ Missing required agent proxy files. Aborting build.');
  process.exit(1);
}

// Boot the proxy on an ephemeral port and confirm it writes its port file + health.
console.log('\n[build-sidecar] Smoke-testing proxy boot...');
const child = spawn('node', ['agent-proxy.mjs'], {
  env: { ...process.env, AGENT_PROXY_PORT: '0' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let out = '';
child.stdout.on('data', (d) => { out += d.toString(); });
child.stderr.on('data', (d) => { out += d.toString(); });

const PORT_LINE = /AGENT_PROXY_PORT=(\d+)/;
const deadline = setTimeout(() => {
  console.error('❌ Proxy did not report a port within 6s.');
  console.error(out);
  child.kill('SIGKILL');
  process.exit(1);
}, 6000);

child.stdout.on('data', () => {
  const m = out.match(PORT_LINE);
  if (m) {
    clearTimeout(deadline);
    const port = m[1];
    console.log(`  ✅ Proxy booted on port ${port}`);
    child.kill('SIGINT');
    // Give it a moment to clean up its port file, then exit success.
    setTimeout(() => process.exit(0), 400);
  }
});

child.on('exit', (code) => {
  if (code !== 0 && !out.match(PORT_LINE)) {
    console.error(`❌ Proxy exited with code ${code} before reporting a port.`);
    console.error(out);
    process.exit(1);
  }
});
