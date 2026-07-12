/**
 * dabasemint Agent Touchpoints
 *
 * Structured, validated, phase-aware agent tasks.
 * These are higher-leverage than kre8nz equivalents because
 * they operate on rich, structured toolchest data (modules, contracts, READMEs, .forge-state).
 *
 * Categories:
 * - Assay (on registration / refresh)
 * - Discovery (cross-toolchest)
 * - Composition (the killer feature)
 * - Context (export quality packs)
 * - Curation (long-term library health)
 */

export const DABASEMINT_TOUCHPOINTS = [
  {
    id: 'assay-toolchest',
    category: 'assay',
    title: 'Assay New Toolchest',
    description: 'Deep analysis of a freshly registered toolchest. Produces rich summary, hidden value, reusability notes, and suggested tags.'
  },
  {
    id: 'find-complements',
    category: 'discovery',
    title: 'Find Complementary Modules',
    description: 'Given one or more modules, find the best complementary pieces across ALL registered toolchests.'
  },
  {
    id: 'composition-advisor',
    category: 'composition',
    title: 'Composition Advisor',
    description: 'Expert guidance while building a blueprint. Suggests wiring, flags conflicts, proposes adapters, and writes integration notes.'
  },
  {
    id: 'generate-blueprint-docs',
    category: 'composition',
    title: 'Blueprint Documentation Writer',
    description: 'Turns a completed composition into excellent README, CONNECTION.md, and usage examples.'
  },
  {
    id: 'build-context-pack',
    category: 'context',
    title: 'Build High-Quality Context Pack',
    description: 'Creates an agent-ready export (contracts + modules + integration guidance) far better than raw file dumps.'
  },
  {
    id: 'gap-analysis',
    category: 'curation',
    title: 'Library Gap Analysis',
    description: 'Across your entire collection, what capabilities are missing for a given goal?'
  },
  {
    id: 'reusability-audit',
    category: 'curation',
    title: 'Module Reusability Audit',
    description: 'Scores how portable and well-documented a specific module is, with concrete improvement suggestions.'
  },
  {
    id: 'context-pack-generator',
    category: 'context',
    title: 'Generate Agent Context Pack',
    description: 'Creates a clean, contract-aware bundle optimized for feeding to other agents (Pi, Cursor, Claude, etc.).'
  }
];

export function buildAgentTouchpointPrompt(id, context = {}) {
  const touchpoint = DABASEMINT_TOUCHPOINTS.find((t) => t.id === id);
  if (!touchpoint) return '';

  switch (id) {
    case 'assay-toolchest':
      return [
        'You are an expert toolchest assayer for dabasemint.',
        'The user has registered a new toolchest. Analyze it deeply using the provided metadata, README excerpts, module list, and any contracts.',
        'Return ONLY valid JSON:',
        '{',
        '  "overallQuality": "high|medium|low",',
        '  "sourceType": "oss-repo|production-web|native-binary|other",',
        '  "richnessScore": 0-100,',
        '  "keyStrengths": ["string"],',
        '  "hiddenGems": [{"module": "string", "why": "string"}],',
        '  "suggestedTags": ["string"],',
        '  "reusabilityNotes": "string",',
        '  "recommendedUseCases": ["string"]',
        '}',
        '',
        `TOOLCHEST_NAME: ${context.toolchestName || 'unknown'}`,
        `FORGE_STATE: ${JSON.stringify(context.forgeState || {}, null, 2)}`,
        `MODULES: ${JSON.stringify(context.modules || [], null, 2)}`,
        `README_EXCERPT: ${context.readmeExcerpt || ''}`
      ].join('\n');

    case 'find-complements':
      return [
        'You are a master parts curator inside dabasemint.',
        'Given the selected module(s), recommend the strongest complementary modules from the entire collection.',
        'Focus on contracts, architectural fit, and real-world composability.',
        'Return ONLY valid JSON:',
        '{',
        '  "complements": [',
        '    {"toolchest": "string", "module": "string", "reason": "string", "integrationEffort": "low|medium|high"}',
        '  ],',
        '  "suggestedBlueprintName": "string",',
        '  "synergyNotes": "string"',
        '}',
        '',
        `PRIMARY_MODULES: ${JSON.stringify(context.primaryModules || [], null, 2)}`,
        `AVAILABLE_TOOLCHESTS: ${JSON.stringify(context.availableToolchests || [], null, 2)}`
      ].join('\n');

    case 'composition-advisor':
      return [
        'You are the dabasemint Composition Advisor — an expert systems architect.',
        'The user is assembling a blueprint from modules across toolchests.',
        'Analyze the current selection, flag risks, suggest wiring strategies, and propose any missing glue or adapters.',
        'Return ONLY valid JSON:',
        '{',
        '  "overallAssessment": "excellent|good|needs-work",',
        '  "recommendedWiring": ["string"],',
        '  "potentialConflicts": [{"modules": ["string"], "issue": "string", "resolution": "string"}],',
        '  "suggestedAdapters": ["string"],',
        '  "missingPieces": ["string"],',
        '  "nextSteps": ["string"]',
        '}',
        '',
        `CURRENT_BLUEPRINT: ${JSON.stringify(context.currentBlueprint || {}, null, 2)}`,
        `GOAL: ${context.goal || ''}`
      ].join('\n');

    case 'build-context-pack':
      return [
        'You are an expert at preparing perfect context for downstream agents (Pi, Claude, Cursor, etc.).',
        'Using the selected modules and their contracts, produce a concise but complete context pack.',
        'Return ONLY valid JSON with keys:',
        '{',
        '  "summary": "string",',
        '  "keyContracts": ["string"],',
        '  "integrationGuidance": "string",',
        '  "importantFiles": ["string"],',
        '  "antiPatterns": ["string"],',
        '  "exampleUsage": "string"',
        '}',
        '',
        `SELECTED_MODULES: ${JSON.stringify(context.selectedModules || [], null, 2)}`
      ].join('\n');

    case 'gap-analysis':
      return [
        'You are performing a strategic gap analysis across the user\'s entire dabasemint library.',
        'Given a user goal, identify what capabilities are missing from their current toolchests.',
        'Return ONLY valid JSON:',
        '{',
        '  "coveredCapabilities": ["string"],',
        '  "gaps": [{"capability": "string", "impact": "high|medium|low", "suggestedSources": "string"}],',
        '  "quickWins": ["string"]',
        '}',
        '',
        `USER_GOAL: ${context.goal || ''}`,
        `LIBRARY_SUMMARY: ${JSON.stringify(context.librarySummary || {}, null, 2)}`
      ].join('\n');

    case 'context-pack-generator':
      return [
        'You are an expert at preparing perfect context for downstream agents.',
        'Using the selected modules and their contracts from dabasemint, produce a concise but complete context pack.',
        'Return ONLY valid JSON:',
        '{',
        '  "summary": "string",',
        '  "keyContracts": ["string"],',
        '  "integrationGuidance": "string",',
        '  "importantModules": ["string"],',
        '  "antiPatterns": ["string"],',
        '  "exampleUsage": "string"',
        '}',
        '',
        `SELECTED_MODULES: ${JSON.stringify(context.selectedModules || [], null, 2)}`
      ].join('\n');

    case 'generate-blueprint-docs':
      return [
        'You are the dabasemint Blueprint Documentation Writer.',
        'Turn the completed composition into concise, ready-to-use documentation.',
        'IMPORTANT: keep each string SHORT (under 120 words) to avoid truncation.',
        'Return ONLY valid JSON — no prose outside the JSON, no markdown code fences:',
        '{',
        '  "readme": "short markdown README string",',
        '  "connectionGuide": "short markdown CONNECTION guide string",',
        '  "usageExample": "short code/config example string",',
        '  "gotchas": ["short string"]',
        '}',
        '',
        `BLUEPRINT: ${JSON.stringify(context.currentBlueprint || context.selectedModules || [], null, 2)}`,
        `GOAL: ${context.goal || 'Build a composed application from these modules'}`
      ].join('\n');

    case 'reusability-audit':
      return [
        'You are a module reusability auditor for dabasemint.',
        'Score how portable and well-documented the given module is, with concrete improvement suggestions.',
        'Return ONLY valid JSON:',
        '{',
        '  "reusabilityScore": 0-100,',
        '  "portability": "high|medium|low",',
        '  "documentationQuality": "high|medium|low",',
        '  "strengths": ["string"],',
        '  "improvements": [{"issue": "string", "fix": "string", "priority": "high|medium|low"}]',
        '}',
        '',
        `MODULE: ${JSON.stringify(context.module || {}, null, 2)}`,
        `PARENT_TOOLCHEST: ${context.toolchestName || 'unknown'}`
      ].join('\n');

    default:
      return '';
  }
}

export function validateAgentTouchpointResponse(id, rawJson) {
  // Lightweight validation. In a full implementation we would use Zod or similar.
  let data;
  try {
    data = JSON.parse(rawJson);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${e.message}`] };
  }

  const errors = [];

  // Basic structural checks per touchpoint
  if (id === 'assay-toolchest') {
    if (!data.overallQuality) errors.push('overallQuality is required');
    if (!Array.isArray(data.keyStrengths)) errors.push('keyStrengths must be an array');
  }

  if (id === 'composition-advisor') {
    if (!data.overallAssessment) errors.push('overallAssessment is required');
  }

  if (errors.length > 0) {
    return { ok: false, errors, data };
  }

  return { ok: true, data };
}

export function getTouchpointsByCategory(category) {
  return DABASEMINT_TOUCHPOINTS.filter((t) => t.category === category);
}
