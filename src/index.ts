import type { Plugin } from '@opencode-ai/plugin';
import { loadConfig, shouldUseProxy, watchConfig } from './config.js';
import type { ProxyPluginConfig, ProviderProxyConfig } from './types.js';

const PLUGIN_NAME = 'opencode-proxy';

interface ProxyState {
  config: ProxyPluginConfig | null;
  debug: boolean;
  originalFetch: typeof fetch | null;
  activeProvider: string | null;
  providerProxies: Map<string, string>;
  // Pre-compiled URL matching rules for performance
  compiledRules: CompiledRules | null;
}

interface CompiledRules {
  // Map from URL pattern to proxy URL or null (for direct)
  patternToProxy: Map<string, string | null>;
  // Default proxy URL if set
  defaultProxy: string | null;
  // Direct patterns that should bypass proxy
  directPatterns: Set<string>;
}

const state: ProxyState = {
  config: null,
  debug: false,
  originalFetch: null,
  activeProvider: null,
  providerProxies: new Map(),
  compiledRules: null,
};

function log(...args: unknown[]): void {
  if (state.debug) {
    console.error(`[${PLUGIN_NAME}]`, ...args);
  }
}

function buildProxyUrl(config: ProviderProxyConfig): string {
  const { protocol, host, port, username, password } = config;

  if (!host || !port) {
    throw new Error('Proxy host and port are required');
  }

  const auth = username
    ? password
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : `${encodeURIComponent(username)}@`
    : '';

  const normalizedProtocol = protocol === 'socks' ? 'socks5' : protocol;

  return `${normalizedProtocol}://${auth}${host}:${port}`;
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

/**
 * Pre-compile URL matching rules for better performance
 * This avoids iterating through all patterns on every request
 */
function compileRules(config: ProxyPluginConfig): CompiledRules {
  const patternToProxy = new Map<string, string | null>();
  const directPatterns = new Set<string>();

  // Compile direct providers from 'direct' list
  for (const providerId of config.direct ?? []) {
    const patterns = getUrlPatternsForProvider(providerId);
    for (const pattern of patterns) {
      const patternLower = pattern.toLowerCase();
      patternToProxy.set(patternLower, null);
      directPatterns.add(patternLower);
    }
  }

  // Compile provider-specific rules
  for (const providerConfig of config.providers ?? []) {
    const patterns = getUrlPatternsForProvider(providerConfig.provider);
    const proxyUrl =
      providerConfig.protocol === 'direct' ? null : buildProxyUrl(providerConfig);

    for (const pattern of patterns) {
      const patternLower = pattern.toLowerCase();
      // Provider-specific rules override direct list
      patternToProxy.set(patternLower, proxyUrl);
      if (proxyUrl === null) {
        directPatterns.add(patternLower);
      } else {
        directPatterns.delete(patternLower);
      }
    }
  }

  // Compile default proxy
  let defaultProxy: string | null = null;
  if (config.defaultProxy && config.defaultProxy.protocol !== 'direct') {
    defaultProxy = buildProxyUrl({
      provider: 'default',
      ...config.defaultProxy,
    });
  }

  return {
    patternToProxy,
    defaultProxy,
    directPatterns,
  };
}

function shouldUseProxyForUrl(url: string): string | null | undefined {
  if (!state.config) return undefined;

  // Use pre-compiled rules if available
  if (state.compiledRules) {
    const urlLower = url.toLowerCase();

    // Check compiled patterns first
    for (const [pattern, proxyUrl] of state.compiledRules.patternToProxy) {
      if (urlLower.includes(pattern)) {
        if (proxyUrl === null) {
          log('Direct connection (compiled):', url.substring(0, 60));
        }
        return proxyUrl;
      }
    }

    // Fall back to default proxy
    if (state.compiledRules.defaultProxy) {
      return state.compiledRules.defaultProxy;
    }

    return undefined;
  }

  // Fallback to dynamic matching if rules not compiled
  const urlLower = url.toLowerCase();

  // Check for direct connection first
  for (const providerId of state.config.direct ?? []) {
    const patterns = getUrlPatternsForProvider(providerId);
    for (const pattern of patterns) {
      if (urlLower.includes(pattern.toLowerCase())) {
        log('Direct connection for:', providerId);
        return null;
      }
    }
  }

  if (state.activeProvider) {
    const proxyUrl = state.providerProxies.get(state.activeProvider);
    if (proxyUrl) {
      return proxyUrl;
    }
  }

  for (const providerConfig of state.config.providers ?? []) {
    if (providerConfig.protocol === 'direct') {
      const patterns = getUrlPatternsForProvider(providerConfig.provider);
      for (const pattern of patterns) {
        if (urlLower.includes(pattern.toLowerCase())) {
          log('Direct connection for:', providerConfig.provider);
          return null;
        }
      }
      continue;
    }

    const patterns = getUrlPatternsForProvider(providerConfig.provider);

    for (const pattern of patterns) {
      if (urlLower.includes(pattern.toLowerCase())) {
        return buildProxyUrl(providerConfig);
      }
    }
  }

  if (state.config.defaultProxy && state.config.defaultProxy.protocol !== 'direct') {
    return buildProxyUrl({
      provider: 'default',
      ...state.config.defaultProxy,
    });
  }

  return undefined;
}

const OpenCodeProxyPlugin: Plugin = async ctx => {
  state.config = loadConfig();

  if (!shouldUseProxy(state.config)) {
    return {};
  }

  const config = state.config!;
  state.debug = config.debug ?? false;

  // Compile rules for better performance
  state.compiledRules = compileRules(config);

  log('Initialized:', {
    providers:
      config.providers?.map(p => p.provider + (p.protocol === 'direct' ? '(direct)' : '')) ?? [],
    direct: config.direct ?? [],
    compiledPatterns: state.compiledRules.patternToProxy.size,
  });

  // Watch config file for changes (hot reload)
  if (config.debug) {
    watchConfig(newConfig => {
      if (newConfig) {
        state.config = newConfig;
        state.debug = newConfig.debug ?? false;
        // Re-compile rules on config change
        state.compiledRules = compileRules(newConfig);
        log('Config reloaded:', {
          providers: newConfig.providers?.map(p => p.provider) ?? [],
          direct: newConfig.direct ?? [],
          compiledPatterns: state.compiledRules.patternToProxy.size,
        });
      }
    });
  }

  // Defer fetch patching to avoid interfering with plugin loading
  setTimeout(() => {
    if (!state.originalFetch) {
      state.originalFetch = globalThis.fetch;
      globalThis.fetch = async (
        input: string | URL | Request,
        init?: RequestInit
      ): Promise<Response> => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        try {
          const proxyUrl = shouldUseProxyForUrl(url);

          if (proxyUrl === null) {
            log('Direct:', url.substring(0, 60));
            return state.originalFetch!(input, init);
          }

          if (proxyUrl) {
            log('Proxy:', url.substring(0, 60), '->', proxyUrl);

            return state.originalFetch!(input, {
              ...init,
              proxy: proxyUrl,
            } as RequestInit & { proxy?: string });
          }
          return state.originalFetch!(input, init);
        } catch (error) {
          log('Error processing request:', error);
          // Fall back to original fetch on error
          return state.originalFetch!(input, init);
        }
      };

      log('Fetch patched');
    }
  }, 0);

  return {};
};

export default OpenCodeProxyPlugin;
