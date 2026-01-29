import type { Plugin } from "@opencode-ai/plugin";
import { loadConfig, getProxyForProvider, shouldUseProxy } from "./config.js";
import { createProxyAgent, createProxiedFetch } from "./proxy.js";
import type { ProxyPluginConfig } from "./types.js";

const PLUGIN_NAME = "opencode-proxy";

interface ProxyState {
  config: ProxyPluginConfig | null;
  debug: boolean;
}

const state: ProxyState = {
  config: null,
  debug: false,
};

function log(...args: unknown[]): void {
  if (state.debug) {
    console.log(`[${PLUGIN_NAME}]`, ...args);
  }
}

const OpenCodeProxyPlugin: Plugin = async (ctx) => {
  state.config = loadConfig();
  
  if (!shouldUseProxy(state.config)) {
    log("No proxy configuration found, plugin disabled");
    return {};
  }
  
  const config = state.config!;
  state.debug = config.debug ?? false;
  
  log("Plugin initialized with config:", {
    providers: config.providers?.map(p => p.provider) ?? [],
    direct: config.direct ?? [],
    hasDefaultProxy: !!config.defaultProxy,
  });

  return {
    "chat.params": async (input, output) => {
      const { provider, model } = input;
      const providerID = provider.source === "custom" 
        ? model.providerID 
        : Object.keys(provider.info ?? {}).length > 0 
          ? (provider.info as any)?.id ?? model.providerID
          : model.providerID;
      
      log("Processing request for provider:", providerID);
      
      const proxyConfig = getProxyForProvider(config, providerID);
      
      if (!proxyConfig) {
        log("No proxy configured for provider:", providerID);
        return;
      }
      
      if (proxyConfig.protocol === "direct") {
        log("Using direct connection for provider:", providerID);
        return;
      }
      
      log("Using proxy for provider:", providerID, {
        protocol: proxyConfig.protocol,
        host: proxyConfig.host,
        port: proxyConfig.port,
      });
      
      const proxyAgent = createProxyAgent(proxyConfig);
      
      if (!proxyAgent) {
        log("Failed to create proxy agent for:", providerID);
        return;
      }
      
      const originalFetch = output.options?.fetch ?? fetch;
      const proxiedFetch = createProxiedFetch(proxyAgent, originalFetch);
      
      output.options = {
        ...output.options,
        fetch: proxiedFetch,
      };
      
      log("Successfully injected proxied fetch for:", providerID);
    },
  };
};

export default OpenCodeProxyPlugin;
export * from "./types.js";
export { loadConfig, getProxyForProvider } from "./config.js";
