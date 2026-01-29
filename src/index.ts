import type { Plugin } from "@opencode-ai/plugin";
import { loadConfig, shouldUseProxy } from "./config.js";
import type { ProxyPluginConfig, ProviderProxyConfig } from "./types.js";

const PLUGIN_NAME = "opencode-proxy";

interface ProxyState {
  config: ProxyPluginConfig | null;
  debug: boolean;
  originalFetch: typeof fetch | null;
  activeProvider: string | null;
  providerProxies: Map<string, string>;
}

const state: ProxyState = {
  config: null,
  debug: false,
  originalFetch: null,
  activeProvider: null,
  providerProxies: new Map(),
};

function log(...args: unknown[]): void {
  if (state.debug) {
    console.error(`[${PLUGIN_NAME}]`, ...args);
  }
}

function buildProxyUrl(config: ProviderProxyConfig): string {
  const { protocol, host, port, username, password } = config;
  
  if (!host || !port) {
    throw new Error("Proxy host and port are required");
  }

  const auth = username 
    ? password 
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : `${encodeURIComponent(username)}@`
    : "";

  const normalizedProtocol = protocol === "socks" ? "socks5" : protocol;
  
  return `${normalizedProtocol}://${auth}${host}:${port}`;
}

function shouldUseProxyForUrl(url: string): string | undefined {
  if (!state.config) return undefined;
  
  const urlLower = url.toLowerCase();
  
  if (state.activeProvider) {
    const proxyUrl = state.providerProxies.get(state.activeProvider);
    if (proxyUrl) {
      return proxyUrl;
    }
  }
  
  for (const providerConfig of state.config.providers ?? []) {
    const patterns = getUrlPatternsForProvider(providerConfig.provider);
    
    for (const pattern of patterns) {
      if (urlLower.includes(pattern.toLowerCase())) {
        return buildProxyUrl(providerConfig);
      }
    }
  }
  
  if (state.config.defaultProxy) {
    return buildProxyUrl({
      provider: "default",
      ...state.config.defaultProxy,
    });
  }
  
  return undefined;
}

function getUrlPatternsForProvider(provider: string): string[] {
  const patterns: Record<string, string[]> = {
    google: ["generativelanguage.googleapis.com", "ai.google.dev", "googleapis.com"],
    "google-vertex": ["vertexai.googleapis.com", "aiplatform.googleapis.com"],
    "google-vertex-anthropic": ["vertexai.googleapis.com"],
    anthropic: ["api.anthropic.com"],
    openai: ["api.openai.com", "openai.azure.com"],
    azure: ["openai.azure.com"],
    "amazon-bedrock": ["bedrock-runtime", "amazonaws.com"],
    moonshot: ["api.moonshot.cn"],
    kimi: ["api.moonshot.cn"],
    deepseek: ["api.deepseek.com"],
    groq: ["api.groq.com"],
    mistral: ["api.mistral.ai"],
    cohere: ["api.cohere.ai"],
    together: ["api.together.xyz"],
    perplexity: ["api.perplexity.ai"],
    openrouter: ["openrouter.ai"],
    "github-copilot": ["api.githubcopilot.com", "copilot-proxy.githubusercontent.com"],
    xai: ["api.x.ai"],
    cerebras: ["api.cerebras.ai"],
    fireworks: ["api.fireworks.ai"],
  };
  
  return patterns[provider] ?? [];
}

const OpenCodeProxyPlugin: Plugin = async (ctx) => {
  state.config = loadConfig();
  
  if (!shouldUseProxy(state.config)) {
    return {};
  }
  
  const config = state.config!;
  state.debug = config.debug ?? false;
  
  log("Initialized:", {
    providers: config.providers?.map(p => p.provider + (p.protocol === "direct" ? "(direct)" : "")) ?? [],
  });

  // Defer fetch patching to avoid interfering with plugin loading
  setTimeout(() => {
    if (!state.originalFetch) {
      state.originalFetch = globalThis.fetch;
      globalThis.fetch = async (
        input: string | URL | Request,
        init?: RequestInit
      ): Promise<Response> => {
        const url = typeof input === "string" 
          ? input 
          : input instanceof URL 
            ? input.toString() 
            : input.url;

        const proxyUrl = shouldUseProxyForUrl(url);
        
        if (proxyUrl) {
          log("Proxy:", url.substring(0, 60), "->", proxyUrl);
          
          return state.originalFetch!(input, {
            ...init,
            proxy: proxyUrl,
          } as any);
        }
        return state.originalFetch!(input, init);
      };
      
      log("Fetch patched");
    }
  }, 0);

  return {};
};

export default OpenCodeProxyPlugin;
