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
  'node20-macos-arm64',   // Apple Silicon (macOS arm64)
  'node20-macos-x64',     // Intel Mac (macOS x64)
  'node20-win-x64',       // Windows (x64)
  'node20-linux-x64',     // Linux (x64)
];

// Produce platform-specific binaries named for Tauri externalBin:
//   agent-proxy-macos-arm64, agent-proxy-macos-x64, etc.
// Run: npm run build:sidecar
// Binaries land in src-tauri/sidecars/ ready for bundling.
// tauri.conf.json externalBin should reference the base or platform variant.

const outDir = 'src-tauri/sidecars';

console.log('Building dabasemint agent-proxy sidecar binaries...');

// Always ensure output dir exists (surgical, no side effects)
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
} else {
  // dir already present - ok
}

let built = 0;
let failed = 0;
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
    built++;
  } catch (err) {
    console.error(`Failed to build for ${target}:`, err.message);
    failed++;
  }
}

console.log(`\n✅ Sidecar build complete. Success: ${built}, Failed: ${failed} (graceful). Binaries in ${outDir}`);
console.log('Update tauri.conf.json externalBin to point to the correct ones for your platform (platform variants or base).');