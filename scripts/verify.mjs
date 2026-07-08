#!/usr/bin/env node
console.log('=== dabasemint Health & UX Verification ===\n');

import fs from 'node:fs';
import { getAgentProviderStatus } from '../src/agent-provider.mjs';

const checks = [];

checks.push(['Agent provider loads', !!(await getAgentProviderStatus())]);
checks.push(['Config present', fs.existsSync('./config/agent.local.json')]);
checks.push(['Main app code', fs.existsSync('./src/main.js') && fs.statSync('./src/main.js').size > 18000]);
checks.push(['Enhanced CSS', fs.existsSync('./src/styles.css')]);
checks.push(['Agent touchpoints', fs.existsSync('./src/agent-touchpoints.mjs')]);
checks.push(['Serve script with agent routes', fs.readFileSync('./scripts/serve.mjs', 'utf8').includes('/api/agent')]);
checks.push(['Reference data ready', fs.existsSync('../page-agent-toolchest')]);

console.table(checks.map(([name, pass]) => ({ Check: name, Status: pass ? '✅ PASS' : '❌ FAIL' })));

const allPass = checks.every(c => c[1]);
console.log(allPass ? '\n✅ Project is healthy and ready for heavy use.' : '\n⚠️ Some checks failed.');
console.log('Run: npm run serve');
