/**
 * dabasemint Agent Provider
 *
 * Ported and adapted from kre8nz with enhancements for toolchest-native use.
 * 
 * Supports:
 * - Novita AI (OpenAI compatible)
 * - G0DM0D3 GLM (Zhipu AI with thinking support)
 *
 * Features:
 * - Multi-source API key resolution (env, config/agent.local.json, ~/.pi/agent/auth.json)
 * - Robust retry with backoff + jitter + retry-after
 * - Structured JSON extraction
 * - Provider status + model catalogs
 *
 * This powers optional agentic capabilities inside dabasemint:
 * - Toolchest assaying
 * - Intelligent composition advice
 * - High-quality context pack generation
 * - Cross-toolchest discovery
 *
 * See STRATEGIC-PLAN.md "Agentic Layer" section.
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_AGENT_CONFIG_PATH = path.join(ROOT, 'config', 'agent.local.json');
const PI_AUTH_PATH = path.join(homedir(), '.pi', 'agent', 'auth.json');

export const DEFAULT_GLM_RETRY = {
  maxRetries: 4,
  initialDelayMs: 1000,
  maxDelayMs: 15000,
  multiplier: 2,
  jitterMs: 250,
  retryableStatuses: [429, 502, 503]
};

export const G0DM0D3_GLM_PROVIDER = {
  id: 'g0dm0d3-glm',
  name: 'G0DM0D3 GLM (Zhipu AI)',
  baseUrl: 'https://api.z.ai/api/coding/paas/v4',
  completionsPath: '/chat/completions',
  apiKeyEnv: 'G0DM0D3_ZHIPU_API_KEY',
  defaultModel: 'glm-5.2',
  thinkingLevel: 'medium',
  compat: {
    thinkingFormat: 'zai'
  }
};

export const NOVITA_PROVIDER = {
  id: 'novita',
  name: 'Novita AI',
  baseUrl: 'https://api.novita.ai/openai/v1',
  completionsPath: '/chat/completions',
  apiKeyEnv: 'NOVITA_API_KEY',
  defaultModel: 'nvidia/nemotron-3-nano-30b-a3b',
  compat: {
    thinkingFormat: 'openai'
  }
};

export const AGENT_PROVIDERS = {
  [NOVITA_PROVIDER.id]: NOVITA_PROVIDER,
  [G0DM0D3_GLM_PROVIDER.id]: G0DM0D3_GLM_PROVIDER
};

export const PROVIDER_PREFERENCE = [NOVITA_PROVIDER.id, G0DM0D3_GLM_PROVIDER.id];

export const G0DM0D3_GLM_MODELS = {
  'glm-5.2': {
    id: 'glm-5.2',
    name: 'G0DM0D3 GLM-5.2',
    reasoning: true
  }
};

export const NOVITA_MODELS = {
  'nvidia/nemotron-3-nano-30b-a3b': {
    id: 'nvidia/nemotron-3-nano-30b-a3b',
    name: 'NVIDIA Nemotron 3 Nano 30B A3B',
    reasoning: false,
    maxTokens: 4096
  }
};

export const DEFAULT_AGENT_PROVIDER = NOVITA_PROVIDER.id;
export const DEFAULT_AGENT_MODEL = NOVITA_PROVIDER.defaultModel;
export const DEFAULT_AGENT_THINKING_LEVEL = 'medium';

let localAgentConfigCache = null;

export function isRetryableAgentStatus(status, retryableStatuses = DEFAULT_GLM_RETRY.retryableStatuses) {
  return retryableStatuses.includes(status);
}

export function parseRetryAfterMs(header) {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

export function computeRetryDelayMs(attempt, {
  initialDelayMs = DEFAULT_GLM_RETRY.initialDelayMs,
  maxDelayMs = DEFAULT_GLM_RETRY.maxDelayMs,
  multiplier = DEFAULT_GLM_RETRY.multiplier,
  retryAfterMs = null,
  jitterMs = DEFAULT_GLM_RETRY.jitterMs
} = {}) {
  if (retryAfterMs != null && retryAfterMs > 0) return Math.min(retryAfterMs, maxDelayMs);
  const base = initialDelayMs * (multiplier ** attempt);
  const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
  return Math.min(base + jitter, maxDelayMs);
}

export async function loadLocalAgentConfig(force = false) {
  if (localAgentConfigCache && !force) return localAgentConfigCache;
  try {
    localAgentConfigCache = JSON.parse(await readFile(LOCAL_AGENT_CONFIG_PATH, 'utf8'));
  } catch {
    localAgentConfigCache = null;
  }
  return localAgentConfigCache;
}

function pickConfiguredKey(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key) return null;
  if (/^(your_|placeholder|replace_me|xxx)/i.test(key)) return null;
  if (key.includes('YOUR_') && key.includes('_HERE')) return null;
  return key;
}

export async function resolveProviderApiKey(providerId) {
  const provider = AGENT_PROVIDERS[providerId];
  if (!provider) return { key: null, source: null };

  const envKey = pickConfiguredKey(process.env[provider.apiKeyEnv]);
  if (envKey) return { key: envKey, source: `env:${provider.apiKeyEnv}` };

  const localConfig = await loadLocalAgentConfig();
  const localKey = pickConfiguredKey(localConfig?.providers?.[providerId]?.apiKey);
  if (localKey) return { key: localKey, source: 'config:config/agent.local.json' };

  if (providerId === G0DM0D3_GLM_PROVIDER.id) {
    try {
      const auth = JSON.parse(await readFile(PI_AUTH_PATH, 'utf8'));
      const piKey = pickConfiguredKey(auth['g0dm0d3-glm']?.key || auth.glm?.key);
      if (piKey) return { key: piKey, source: 'pi:~/.pi/agent/auth.json' };
    } catch {
      // ignore missing pi auth
    }
  }

  return { key: null, source: null };
}

export function getProviderModelCatalog(providerId) {
  if (providerId === G0DM0D3_GLM_PROVIDER.id) return G0DM0D3_GLM_MODELS;
  if (providerId === NOVITA_PROVIDER.id) return NOVITA_MODELS;
  return {};
}

export async function getProviderStatus(providerId) {
  const provider = AGENT_PROVIDERS[providerId];
  if (!provider) return null;

  const auth = await resolveProviderApiKey(providerId);
  const models = Object.values(getProviderModelCatalog(providerId));

  return {
    id: provider.id,
    name: provider.name,
    configured: Boolean(auth.key),
    model: provider.defaultModel,
    models: models.map((item) => item.id),
    baseUrl: provider.baseUrl,
    thinkingLevel: provider.thinkingLevel || null,
    retry: DEFAULT_GLM_RETRY,
    authSource: auth.source,
    apiKeyEnv: provider.apiKeyEnv,
    configPath: providerId === NOVITA_PROVIDER.id ? 'config/agent.local.json' : null,
    configExamplePath: 'config/agent.local.json.example'
  };
}

export async function resolveDefaultProviderId(preferredProviderId = null) {
  const localConfig = await loadLocalAgentConfig();
  const candidates = [
    preferredProviderId,
    localConfig?.defaultProvider,
    ...PROVIDER_PREFERENCE
  ].filter(Boolean);

  for (const providerId of candidates) {
    const status = await getProviderStatus(providerId);
    if (status?.configured) return providerId;
  }

  return preferredProviderId || localConfig?.defaultProvider || DEFAULT_AGENT_PROVIDER;
}

export async function getAgentProviderStatus(preferredProviderId = null) {
  const providers = await Promise.all(PROVIDER_PREFERENCE.map((id) => getProviderStatus(id)));
  const activeProviderId = await resolveDefaultProviderId(preferredProviderId);
  const active = providers.find((item) => item?.id === activeProviderId) || providers[0];

  return {
    configured: Boolean(active?.configured),
    provider: active?.id || DEFAULT_AGENT_PROVIDER,
    model: active?.model || DEFAULT_AGENT_MODEL,
    thinkingLevel: active?.thinkingLevel || DEFAULT_AGENT_THINKING_LEVEL,
    baseUrl: active?.baseUrl || NOVITA_PROVIDER.baseUrl,
    retry: DEFAULT_GLM_RETRY,
    authSource: active?.authSource || null,
    providers,  // full list for multi-provider health display (R3)
    active,
    multiProvider: true,  // R3 enhancement: signals better multi-provider status support
    proxyHealthSupported: true
  };
}

export function buildProviderCompletionBody(providerId, prompt, {
  model,
  thinkingLevel = DEFAULT_AGENT_THINKING_LEVEL,
  maxTokens = 4096,
  temperature = 0.2
} = {}) {
  const provider = AGENT_PROVIDERS[providerId];
  const modelId = model || provider.defaultModel;

  const body = {
    model: modelId,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature,
    stream: false
  };

  if (providerId === G0DM0D3_GLM_PROVIDER.id) {
    const modelDef = G0DM0D3_GLM_MODELS[modelId] || G0DM0D3_GLM_MODELS[provider.defaultModel];
    if (modelDef?.reasoning && provider.compat.thinkingFormat === 'zai') {
      body.enable_thinking = thinkingLevel !== 'off';
    }
  }

  return body;
}

export function repairJsonString(str) {
  // Repair common LLM JSON malformations:
  //  1. raw control chars (0x00-0x1F) inside strings ("Bad control character")
  //  2. invalid escape sequences like \( or \% ("Bad escaped character")
  let s = String(str);
  // Replace raw control chars with a space (valid JSON strings can't hold them).
  // \n \t \r are already escaped in well-formed output; raw ones break parsing.
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ');
  // Keep newline/CR/tab inside strings by escaping them so multi-line values parse.
  s = s.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  // Fix invalid escape sequences: a backslash not followed by a valid JSON escape
  // char (" \ / b f n r t u). Turn "\<bad>" into "\\<bad>" (literal backslash).
  s = s.replace(/\\(?!["\\\/bfnrtu])/g, '\\\\');
  return s;
}

export function extractJsonFromCompletion(raw = '') {
  const trimmed = String(raw).trim();
  if (!trimmed) return { ok: false, error: 'Empty model response.' };

  try {
    return { ok: true, data: JSON.parse(trimmed) };
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return { ok: true, data: JSON.parse(fenced[1].trim()) };
    } catch {
      // continue
    }
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = trimmed.slice(start, end + 1);
    try {
      return { ok: true, data: JSON.parse(slice) };
    } catch {
      // Last resort: repair common LLM malformations (control chars, bad escapes).
      try {
        return { ok: true, data: JSON.parse(repairJsonString(slice)) };
      } catch (error) {
        return { ok: false, error: `Could not parse JSON object from model response: ${error.message}` };
      }
    }
  }

  return { ok: false, error: 'Model response did not contain JSON.' };
}

export function extractCompletionText(payload) {
  const choice = payload?.choices?.[0];
  const message = choice?.message || {};
  if (typeof message.content === 'string' && message.content.trim()) return message.content.trim();

  if (Array.isArray(message.content)) {
    const text = message.content
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n')
      .trim();
    if (text) return text;
  }

  // Reasoning models (e.g. Novita Nemotron) sometimes leave `content` empty and
  // emit the actual answer in `reasoning_content`. Fall back to it so we don't
  // throw "no text content" on valid responses.
  if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
    return message.reasoning_content.trim();
  }

  if (typeof choice?.text === 'string' && choice.text.trim()) return choice.text.trim();
  return '';
}

export async function callProviderCompletion(providerId, prompt, options = {}, fetchImpl = fetch) {
  const provider = AGENT_PROVIDERS[providerId];
  if (!provider) {
    return { ok: false, error: `Unknown agent provider: ${providerId}` };
  }

  const auth = await resolveProviderApiKey(providerId);
  const apiKey = options.apiKey || auth.key;
  if (!apiKey) {
    const hint = providerId === NOVITA_PROVIDER.id
      ? 'Set NOVITA_API_KEY or add your key to config/agent.local.json (copy from config/agent.local.json.example).'
      : 'Set G0DM0D3_ZHIPU_API_KEY or add g0dm0d3-glm to ~/.pi/agent/auth.json.';
    return { ok: false, error: `${provider.name} not configured. ${hint}`, provider: providerId };
  }

  const model = options.model || provider.defaultModel;
  const body = buildProviderCompletionBody(providerId, prompt, options);
  const url = `${provider.baseUrl}${provider.completionsPath}`;
  const retry = { ...DEFAULT_GLM_RETRY, ...options.retry };
  const sleepFn = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  let attempts = 0;
  let retries = 0;
  let lastFailure = null;

  for (let attempt = 0; attempt <= retry.maxRetries; attempt += 1) {
    attempts = attempt + 1;

    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      return {
        ok: false,
        error: `${provider.name} request failed: ${error.message}`,
        provider: providerId,
        model,
        attempts,
        retries
      };
    }

    const rawText = await response.text();
    let payload;
    try {
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {
      return {
        ok: false,
        error: `${provider.name} returned non-JSON response.`,
        raw: rawText,
        provider: providerId,
        model,
        attempts,
        retries
      };
    }

    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
      lastFailure = { error: message, raw: rawText, status: response.status };

      if (!isRetryableAgentStatus(response.status, retry.retryableStatuses) || attempt >= retry.maxRetries) {
        return {
          ok: false,
          ...lastFailure,
          provider: providerId,
          model,
          attempts,
          retries
        };
      }

      const retryAfterHeader = typeof response.headers?.get === 'function'
        ? response.headers.get('retry-after')
        : null;
      const delayMs = computeRetryDelayMs(attempt, {
        initialDelayMs: retry.initialDelayMs,
        maxDelayMs: retry.maxDelayMs,
        multiplier: retry.multiplier,
        retryAfterMs: parseRetryAfterMs(retryAfterHeader),
        jitterMs: retry.jitterMs ?? 250
      });

      retries += 1;
      await sleepFn(delayMs);
      continue;
    }

    const content = extractCompletionText(payload);
    if (!content) {
      return {
        ok: false,
        error: `${provider.name} response had no text content.`,
        raw: rawText,
        provider: providerId,
        model,
        attempts,
        retries
      };
    }

    return {
      ok: true,
      content,
      raw: rawText,
      model,
      provider: providerId,
      usage: payload.usage || null,
      attempts,
      retries
    };
  }

  return {
    ok: false,
    ...(lastFailure || { error: `${provider.name} request failed after retries.` }),
    provider: providerId,
    model,
    attempts,
    retries
  };
}

export async function callG0dm0d3GlmCompletion(prompt, options = {}, fetchImpl = fetch) {
  return callProviderCompletion(G0DM0D3_GLM_PROVIDER.id, prompt, options, fetchImpl);
}

export async function callNovitaCompletion(prompt, options = {}, fetchImpl = fetch) {
  return callProviderCompletion(NOVITA_PROVIDER.id, prompt, options, fetchImpl);
}

/**
 * Generic entry point for running a named "touchpoint".
 * In dabasemint these are higher-level and toolchest-aware.
 * See src/agent-touchpoints.mjs for the current catalog.
 */
export async function runAgentTouchpoint(id, context = {}, options = {}, fetchImpl = fetch) {
  const { buildAgentTouchpointPrompt, validateAgentTouchpointResponse } = await import('./agent-touchpoints.mjs');

  const prompt = buildAgentTouchpointPrompt(id, context);
  if (!prompt) return { ok: false, error: `Unknown touchpoint: ${id}` };

  const providerId = options.provider || await resolveDefaultProviderId(options.preferredProvider);

  // Content-level retries: small reasoning models are non-deterministic and
  // sometimes emit empty/degenerate output or unparseable JSON. A fresh call
  // often succeeds, so retry on bad CONTENT (but never on network/config errors).
  const contentRetries = Number.isFinite(options.contentRetries) ? options.contentRetries : 2;
  const sleepFn = options.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));

  let lastFailure = null;
  for (let attempt = 0; attempt <= contentRetries; attempt += 1) {
    // nudge temperature slightly on retries to escape degenerate outputs
    const callOpts = attempt > 0 ? { ...options, temperature: Math.min(0.8, (options.temperature ?? 0.2) + 0.2 * attempt) } : options;

    const completion = await callProviderCompletion(providerId, prompt, callOpts, fetchImpl);
    if (!completion.ok) return completion; // network/config/auth error — do not retry

    // Empty or degenerate content -> retry
    if (!completion.content || completion.content.trim().length < 2) {
      lastFailure = {
        ok: false,
        error: `${completion.provider || providerId} returned empty/degenerate content (attempt ${attempt + 1}).`,
        raw: completion.content,
        prompt,
        provider: completion.provider,
        model: completion.model,
        contentAttempts: attempt + 1
      };
      if (attempt < contentRetries) { await sleepFn(250); continue; }
      return lastFailure;
    }

    const parsed = extractJsonFromCompletion(completion.content);
    if (!parsed.ok) {
      lastFailure = {
        ok: false,
        error: `${parsed.error} (attempt ${attempt + 1})`,
        raw: completion.content,
        prompt,
        provider: completion.provider,
        model: completion.model,
        contentAttempts: attempt + 1
      };
      if (attempt < contentRetries) { await sleepFn(250); continue; }
      return lastFailure;
    }

    const validation = validateAgentTouchpointResponse(id, JSON.stringify(parsed.data));
    if (!validation.ok) {
      lastFailure = {
        ok: false,
        error: `Model JSON failed touchpoint validation (attempt ${attempt + 1}).`,
        validationErrors: validation.errors,
        raw: completion.content,
        data: parsed.data,
        prompt,
        provider: completion.provider,
        model: completion.model,
        contentAttempts: attempt + 1
      };
      if (attempt < contentRetries) { await sleepFn(250); continue; }
      return lastFailure;
    }

    return {
      ok: true,
      id,
      prompt,
      raw: completion.content,
      data: validation.data,
      model: completion.model,
      provider: completion.provider,
      usage: completion.usage,
      attempts: completion.attempts,
      retries: completion.retries,
      contentAttempts: attempt + 1
    };
  }

  return lastFailure || { ok: false, error: 'Touchpoint failed.', prompt, provider: providerId };
}

// Minor enhancement for R3: simple health ping helper (used by UI for proxy health)
export async function checkProxyHealth(baseUrl = '') {
  try {
    let url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/api/agent/health` : '/api/agent/health';
    if (!baseUrl && !url.startsWith('http')) {
      // node context fallback for testing (browser uses relative ok)
      url = 'http://127.0.0.1:0/api/agent/health'; // will fail but prevents parse error; real use via base
    }
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, ...data, checkedAt: Date.now() };
  } catch (e) {
    return { ok: false, error: e.message || String(e), checkedAt: Date.now() };
  }
}
