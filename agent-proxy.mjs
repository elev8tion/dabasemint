#!/usr/bin/env node
/**
 * dabasemint Agent Proxy Sidecar
 * 
 * Standalone HTTP server that only handles agent API routes.
 * Used as a Tauri sidecar so the agent proxy runs automatically
 * inside the desktop app without needing a separate `npm run serve`.
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getAgentProviderStatus, runAgentTouchpoint } from './src/agent-provider.mjs';

const PORT = process.env.AGENT_PROXY_PORT || 0; // 0 = random available port

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

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

  if (req.method === 'GET' && url.pathname === '/api/agent/health') {
    const addr = server.address();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, port: addr ? addr.port : null, uptime: process.uptime(), pid: process.pid }));
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
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  const addr = server.address();
  console.log(`[dabasemint-agent-proxy] Listening on http://127.0.0.1:${addr.port}`);
  // Print the port so the parent process (Tauri) can read it
  if (process.send) {
    process.send({ type: 'port', port: addr.port });
  } else {
    // Fallback: print to stdout for parent to parse
    console.log(`AGENT_PROXY_PORT=${addr.port}`);
  }

  // Write port file for reliable discovery (RECOMMENDATIONS.md)
  try {
    const dir = path.join(os.homedir(), '.dabasemint');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const portFile = path.join(dir, 'agent-proxy-port.json');
    fs.writeFileSync(portFile, JSON.stringify({ port: addr.port, pid: process.pid, started: Date.now() }));
  } catch (e) { console.error('port file write failed', e); }
});

function cleanup() {
  try {
    const dir = path.join(os.homedir(), '.dabasemint');
    const portFile = path.join(dir, 'agent-proxy-port.json');
    if (fs.existsSync(portFile)) fs.unlinkSync(portFile);
  } catch {}
}

function shutdown(signal) {
  console.log(`[dabasemint-agent-proxy] ${signal} received, shutting down`);
  cleanup();
  server.close(() => process.exit(0));
  // Force-exit after a short grace period if server.close hangs
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('exit', cleanup);