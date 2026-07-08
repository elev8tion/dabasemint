#!/usr/bin/env node
/**
 * Build script for dabasemint agent proxy sidecar.
 * Uses @yao-pkg/pkg to produce platform-specific binaries for Tauri externalBin.
 *
 * Run: npm run build:sidecar
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const targets = [
  'node20-macos-arm64',   // Apple Silicon
  'node20-macos-x64',     // Intel Mac
  'node20-win-x64',       // Windows
  'node20-linux-x64',     // Linux
];

const outDir = 'src-tauri/sidecars';

console.log('Building dabasemint agent-proxy sidecar binaries...');

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

for (const target of targets) {
  const platform = target.split('-')[1];
  const arch = target.split('-')[2];
  const outName = `agent-proxy-${platform}-${arch}`;

  console.log(`\n→ Building for ${target} → ${outName}`);

  try {
    execSync(
      `npx pkg agent-proxy.mjs --targets ${target} --output ${join(outDir, outName)} --compress GZip`,
      { stdio: 'inherit' }
    );
  } catch (err) {
    console.error(`Failed to build for ${target}:`, err.message);
  }
}

console.log('\n✅ Sidecar binaries built in', outDir);
console.log('Update tauri.conf.json externalBin to point to the correct ones for your platform.');