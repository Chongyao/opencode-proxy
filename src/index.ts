import type { Plugin } from '@opencode-ai/plugin';
import { loadConfig, shouldUseProxy, watchConfig, parseProxyUrl, getConfiguredProviders } from './config.js';
import type { ProxyPluginConfig, ProxyConfig } from './types.js';

const PLUGIN_NAME = 'opencode-proxy';

interface ProxyState {
  config: ProxyPluginConfig | null;
  debug: boolean;
  compiledRules: Map<string, string> | null;
}

const state: ProxyState = {
  config: null,
  debug: false,
  compiledRules: null,
};

function log(...args: unknown[]): void {
  if (state.debug) {
    console.error(`[${PLUGIN_NAME}]`, ...args);
  }
}

function getUrlPatternsForProvider(provider: string): string[] {
  const patterns: Record<string, string[]> = {
    google: ['generativelanguage.googleapis.com', 'ai.google.dev', 'googleapis.com'],
    'google-vertex': ['vertexai.googleapis.com', 'aiplatform.googleapis.com'],
    'google-vertex-anthropic': ['vertexai.googleapis.com'],
    anthropic: ['api.anthropic.com'],
    openai: ['api.openai.com', 'openai.azure.com'],
    azure: ['openai.azure.com'],
    'amazon-bedrock': ['bedrock-runtime', 'amazonaws.com'],
    moonshot: ['api.moonshot.cn'],
    kimi: ['api.moonshot.cn'],
    deepseek: ['api.deepseek.com'],
    groq: ['api.groq.com'],
    mistral: ['api.mistral.ai'],
    cohere: ['api.cohere.ai'],
    together: ['api.together.xyz'],
    perplexity: ['api.perplexity.ai'],
    openrouter: ['openrouter.ai'],
    'github-copilot': ['api.githubcopilot.com', 'copilot-proxy.githubusercontent.com'],
    xai: ['api.x.ai'],
    cerebras: ['api.cerebras.ai'],
    fireworks: ['api.fireworks.ai'],
  };

  return patterns[provider] ?? [];
}

function buildProxyUrl(config: ProxyConfig): string {
  const { protocol, host, port, username, password } = config;

  const auth = username
    ? password
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : `${encodeURIComponent(username)}@`
    : '';

  const normalizedProtocol = protocol === 'socks' ? 'socks5' : protocol;

  return `${normalizedProtocol}://${auth}${host}:${port}`;
}

function compileRules(config: ProxyPluginConfig): Map<string, string> {
  const rules = new Map<string, string>();
  const providers = getConfiguredProviders(config);

  for (const provider of providers) {
    const proxyConfig = parseProxyUrl(config[provider] as string);
    if (!proxyConfig) continue;

    const proxyUrl = buildProxyUrl(proxyConfig);
    const patterns = getUrlPatternsForProvider(provider);

    for (const pattern of patterns) {
      rules.set(pattern.toLowerCase(), proxyUrl);
    }
  }

  return rules;
}

function shouldUseProxyForUrl(url: string): string | null | undefined {
  if (!state.config || !state.compiledRules) return undefined;

  const urlLower = url.toLowerCase();

  for (const [pattern, proxyUrl] of state.compiledRules) {
    if (urlLower.includes(pattern)) {
      return proxyUrl;
    }
  }

  return undefined;
}

function createProxiedFetch(originalFetch: typeof fetch): typeof fetch {
  return async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    try {
      const proxyUrl = shouldUseProxyForUrl(url);

      if (proxyUrl === null || proxyUrl === undefined) {
        log('Direct:', url.substring(0, 60));
        return originalFetch(input, init);
      }

      log('Proxy:', url.substring(0, 60), '->', proxyUrl);
      return originalFetch(input, {
        ...init,
        proxy: proxyUrl,
      } as RequestInit & { proxy?: string });
    } catch (error) {
      log('Error:', error);
      return originalFetch(input, init);
    }
  };
}

const OpenCodeProxyPlugin: Plugin = async (ctx) => {
  state.config = loadConfig();

  if (!shouldUseProxy(state.config)) {
    return {};
  }

  const config = state.config!;
  state.debug = config.debug ?? false;
  state.compiledRules = compileRules(config);

  const providers = getConfiguredProviders(config);
  log('Initialized:', {
    providers,
    patterns: state.compiledRules.size,
  });

  if (config.debug) {
    watchConfig(newConfig => {
      if (newConfig) {
        state.config = newConfig;
        state.debug = newConfig.debug ?? false;
        state.compiledRules = compileRules(newConfig);
        log('Config reloaded');
      }
    });
  }

  // Patch global fetch
  if ((globalThis as any).fetch && !(globalThis as any).__opencodeProxyPatched) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createProxiedFetch(originalFetch);
    (globalThis as any).__opencodeProxyPatched = true;
    log('Fetch patched');
  }

  return {};
};

export default OpenCodeProxyPlugin;
