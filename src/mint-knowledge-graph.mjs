/**
 * dabasemint Mint Knowledge Graph
 *
 * Persistent graph of all registered toolchests, modules, blueprints,
 * mint outcomes, and agentic insights. Powers self-improving composition,
 * trade routes, gap analysis, and reusability memory.
 *
 * Zero heavy deps — uses JSON files + in-memory index for now.
 * Persisted to registry/mint-kg.json (alongside existing registry.json).
 *
 * Integrates with toolchest-loader.js and main.js canvas events.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const KG_PATH = path.join(ROOT, 'registry', 'mint-kg.json');
const REGISTRY_DIR = path.join(ROOT, 'registry');

const DEFAULT_KG = {
  nodes: {},
  edges: [],
  metadata: {
    lastUpdated: new Date().toISOString(),
    toolchestCount: 0,
    mintCount: 0,
    version: "1.0"
  }
};

let kgCache = null;

async function ensureDir() {
  if (!existsSync(REGISTRY_DIR)) {
    await mkdir(REGISTRY_DIR, { recursive: true });
  }
}

async function loadKG() {
  if (kgCache) return kgCache;
  await ensureDir();

  if (existsSync(KG_PATH)) {
    try {
      const data = await readFile(KG_PATH, 'utf8');
      kgCache = JSON.parse(data);
      return kgCache;
    } catch (e) {
      console.warn('Failed to parse mint-kg.json, starting fresh', e.message);
    }
  }

  kgCache = structuredClone(DEFAULT_KG);
  await saveKG();
  return kgCache;
}

async function saveKG() {
  if (!kgCache) return;
  kgCache.metadata.lastUpdated = new Date().toISOString();
  await ensureDir();
  await writeFile(KG_PATH, JSON.stringify(kgCache, null, 2));
}

export async function initMintKG() {
  return await loadKG();
}

export async function upsertToolchest(toolchestId, data) {
  const kg = await loadKG();

  kg.nodes[toolchestId] = {
    type: 'toolchest',
    id: toolchestId,
    name: data.name || toolchestId,
    quality: data.overallQuality || 'medium',
    richnessScore: data.richnessScore || 65,
    modules: data.modules?.length || 0,
    contracts: data.contracts?.length || 0,
    timestamp: new Date().toISOString(),
    ...data
  };

  kg.metadata.toolchestCount = Object.keys(kg.nodes).filter(k => kg.nodes[k].type === 'toolchest').length;

  await saveKG();
  return kg.nodes[toolchestId];
}

export async function recordMintOutcome(blueprintId, qualityScore, lessons = [], complements = []) {
  const kg = await loadKG();
  const mintId = `mint-${Date.now()}`;

  kg.nodes[mintId] = {
    type: 'mint',
    id: mintId,
    blueprintId,
    qualityScore,
    lessons,
    complementsUsed: complements,
    timestamp: new Date().toISOString()
  };

  // Create edges
  lessons.forEach(lesson => {
    kg.edges.push({
      from: blueprintId,
      to: mintId,
      type: 'improved-by',
      strength: qualityScore / 100,
      note: lesson
    });
  });

  complements.forEach(comp => {
    kg.edges.push({
      from: blueprintId,
      to: comp,
      type: 'composed-with',
      strength: 0.8
    });
  });

  kg.metadata.mintCount = (kg.metadata.mintCount || 0) + 1;
  await saveKG();

  return { mintId, qualityScore, lessons };
}

export async function queryGraph(pattern = {}) {
  const kg = await loadKG();

  const results = {
    nodes: {},
    edges: []
  };

  // Simple pattern matching for now (expand with proper query language later)
  if (pattern.type) {
    Object.keys(kg.nodes).forEach(id => {
      const node = kg.nodes[id];
      if (node.type === pattern.type) {
        results.nodes[id] = node;
      }
    });
  } else {
    results.nodes = { ...kg.nodes };
  }

  results.edges = kg.edges.filter(e => {
    if (pattern.from && e.from !== pattern.from) return false;
    if (pattern.to && e.to !== pattern.to) return false;
    if (pattern.type && e.type !== pattern.type) return false;
    return true;
  });

  return results;
}

export async function findComplements(moduleIds) {
  const kg = await loadKG();
  // Placeholder for real graph traversal — will be replaced by dedicated chain later
  return {
    suggestions: Object.values(kg.nodes)
      .filter(n => n.type === 'toolchest' && !moduleIds.includes(n.id))
      .slice(0, 5)
      .map(n => ({ id: n.id, name: n.name, reason: 'High complementarity from KG history' })),
    fromKG: true
  };
}

// Hook for toolchest-loader.js
export async function syncToolchestToKG(toolchest) {
  if (!toolchest?.id) return null;
  return await upsertToolchest(toolchest.id, {
    name: toolchest.name || 'Unnamed Toolchest',
    overallQuality: toolchest.overallQuality,
    richnessScore: toolchest.richnessScore || 70,
    modules: toolchest.modules || [],
    contracts: toolchest.contracts || []
  });
}

// For canvas integration
export async function recordCompositionEvent(blueprint, outcome) {
  return await recordMintOutcome(
    blueprint.id || 'current-blueprint',
    outcome.qualityScore || 75,
    outcome.lessons || ['Blueprint successfully composed'],
    outcome.complements || []
  );
}

console.log('✅ Mint Knowledge Graph module loaded — persistent memory for toolchests and composition now active.');
