import type { Plugin } from '@opencode-ai/plugin';
import { loadConfig, shouldUseProxy, watchConfig, parseProxyUrl, getConfiguredProviders } from './config.js';
import type { ProxyPluginConfig, ProxyConfig } from './types.js';

const PLUGIN_NAME = 'opencode-proxy';

interface ProxyState {
  config: ProxyPluginConfig | null;
  debug: boolean;
  originalFetch: typeof fetch | null;
  // Map from provider to proxy config
  providerProxies: Map<string, ProxyConfig>;
  // Map from URL pattern to proxy URL
  compiledRules: Map<string, string> | null;
}

interface CompiledRule {
  pattern: string;
  proxyUrl: string;
}

const state: ProxyState = {
  config: null,
  debug: false,
  originalFetch: null,
  providerProxies: new Map(),
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

/**
 * Build proxy URL string from ProxyConfig
 */
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

/**
 * Compile provider configs into URL pattern -> proxy URL map
 */
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

/**
 * Check if URL should use proxy
 * Returns proxy URL string if should use proxy
 * Returns null if should connect directly
 * Returns undefined if no matching rule
 */
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

const OpenCodeProxyPlugin: Plugin = async () => {
  state.config = loadConfig();

  if (!shouldUseProxy(state.config)) {
    console.error('[opencode-proxy] No proxy configured, skipping');
    return {};
  }

  const config = state.config!;
  state.debug = config.debug ?? false;

  // Compile rules for better performance
  state.compiledRules = compileRules(config);

  const providers = getConfiguredProviders(config);
  console.error('[opencode-proxy] Initialized:', {
    providers,
    patterns: state.compiledRules.size,
    rules: Object.fromEntries(state.compiledRules),
  });

  // Watch config file for changes (hot reload)
  if (config.debug) {
    watchConfig(newConfig => {
      if (newConfig) {
        state.config = newConfig;
        state.debug = newConfig.debug ?? false;
        state.compiledRules = compileRules(newConfig);
        log('Config reloaded:', {
          providers: getConfiguredProviders(newConfig),
          patterns: state.compiledRules.size,
        });
      }
    });
  }

  // Defer fetch patching to avoid interfering with plugin loading
  // Use longer delay to ensure we patch after other plugins
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

          if (proxyUrl === null || proxyUrl === undefined) {
            // Direct connection - either explicitly configured or not in proxy list
            log('Direct:', url.substring(0, 60));
            return state.originalFetch!(input, init);
          }

          console.error('[opencode-proxy] Proxy:', url.substring(0, 60), '->', proxyUrl);
          const startTime = Date.now();
          const response = await state.originalFetch!(input, {
            ...init,
            proxy: proxyUrl,
          } as RequestInit & { proxy?: string });
          console.error('[opencode-proxy] Response:', url.substring(0, 60), 'in', Date.now() - startTime, 'ms');
          return response;
        } catch (error) {
          log('Error processing request:', error);
          return state.originalFetch!(input, init);
        }
      };

      console.error('[opencode-proxy] Fetch patched successfully');
    } else {
      console.error('[opencode-proxy] Fetch already patched by another plugin');
    }
  }, 100); // Increased delay to ensure we patch after other plugins

  return {};
};

export default OpenCodeProxyPlugin;
