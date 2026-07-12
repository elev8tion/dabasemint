#!/usr/bin/env node
/**
 * dabasemint Dev Server
 *
 * Serves the visual masterpiece + agent API routes.
 * Agent routes are proxied server-side so API keys never reach the browser.
 *
 * Usage: npm run serve   or  node scripts/serve.mjs
 */

import http from 'node:http';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgentProviderStatus, runAgentTouchpoint } from '../src/agent-provider.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 4174);

async function start() {
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    // === Agent API Routes (server-side only) ===
    if (url.pathname.startsWith('/api/agent')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/agent/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, mode: 'serve', uptime: process.uptime(), pid: process.pid }));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/agent/status') {
        try {
          const preferred = url.searchParams.get('provider') || undefined;
          const status = await getAgentProviderStatus(preferred);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(status));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/agent/touchpoint') {
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');

          const result = await runAgentTouchpoint(
            body.id,
            body.context || {},
            {
              provider: body.provider,
              preferredProvider: body.preferredProvider,
              model: body.model,
              thinkingLevel: body.thinkingLevel
            }
          );

          res.writeHead(result.ok ? 200 : 502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Unknown agent endpoint' }));
      return;
    }

    // === Vite dev middleware + static serving ===
    vite.middlewares(req, res, () => {
      // fallback handled by Vite
    });
  });

  server.listen(PORT, () => {
    console.log(`\n  dabasemint — FULL AMBITIONS ready at http://localhost:${PORT}`);
    console.log(`  • Visual library + anatomy + composition canvas`);
    console.log(`  • Agent layer active (Novita + G0DM0D3 GLM)`);
    console.log(`  • Run Assay and Composition Advisor buttons wired\n`);
  });
}

start().catch((err) => {
  console.error('Failed to start dabasemint server:', err);
  process.exit(1);
});
