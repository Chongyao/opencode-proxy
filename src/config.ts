import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ProxyPluginConfig, ProviderProxyConfig, ProxyConfig } from "./types.js";

const CONFIG_FILENAME = "proxy.json";
const CONFIG_DIR = "opencode";

export function getConfigPath(): string {
  const configDir = process.env.XDG_CONFIG_HOME 
    ?? path.join(os.homedir(), ".config");
  return path.join(configDir, CONFIG_DIR, CONFIG_FILENAME);
}

/**
 * Parse proxy URL from environment variable
 * Format: protocol://[username:password@]host:port
 */
function parseProxyUrl(url: string): ProxyConfig | null {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.replace(':', '') as ProxyConfig['protocol'];
    const port = parseInt(parsed.port, 10);
    
    if (!port || port < 1 || port > 65535) {
      return null;
    }
    
    const config: ProxyConfig = {
      protocol,
      host: parsed.hostname,
      port,
    };
    
    if (parsed.username) {
      config.username = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
      config.password = decodeURIComponent(parsed.password);
    }
    
    return config;
  } catch {
    return null;
  }
}

/**
 * Load configuration from environment variables
 */
function loadConfigFromEnv(): ProxyPluginConfig | null {
  const config: ProxyPluginConfig = {};
  const providers: ProviderProxyConfig[] = [];
  
  // Check for debug mode
  if (process.env.OPENCODE_PROXY_DEBUG === 'true') {
    config.debug = true;
  }
  
  // Check for timeout
  if (process.env.OPENCODE_PROXY_TIMEOUT) {
    const timeout = parseInt(process.env.OPENCODE_PROXY_TIMEOUT, 10);
    if (!isNaN(timeout)) {
      config.timeout = timeout;
    }
  }
  
  // Check for default proxy
  if (process.env.OPENCODE_PROXY_DEFAULT) {
    const defaultProxy = parseProxyUrl(process.env.OPENCODE_PROXY_DEFAULT);
    if (defaultProxy) {
      config.defaultProxy = defaultProxy;
    }
  }
  
  // Check for provider-specific proxies (OPENCODE_PROXY_<PROVIDER_NAME>)
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('OPENCODE_PROXY_') && key !== 'OPENCODE_PROXY_DEFAULT' && key !== 'OPENCODE_PROXY_DEBUG' && key !== 'OPENCODE_PROXY_TIMEOUT') {
      if (!value) continue;
      const providerName = key.replace('OPENCODE_PROXY_', '').toLowerCase();
      const proxyConfig = parseProxyUrl(value);
      
      if (proxyConfig) {
        providers.push({
          provider: providerName,
          ...proxyConfig,
        });
      }
    }
  }
  
  if (providers.length > 0) {
    config.providers = providers;
  }
  
  // Check for direct providers (comma-separated list)
  if (process.env.OPENCODE_PROXY_DIRECT) {
    config.direct = process.env.OPENCODE_PROXY_DIRECT.split(',').map(p => p.trim()).filter(Boolean);
  }
  
  return Object.keys(config).length > 0 ? config : null;
}

export function loadConfig(): ProxyPluginConfig | null {
  const configPath = getConfigPath();
  
  try {
    let fileConfig: ProxyPluginConfig | null = null;
    
    // Try to load from file
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      fileConfig = JSON.parse(content);
      
      if (!validateConfig(fileConfig)) {
        fileConfig = null;
      }
    }
    
    // Load from environment variables
    const envConfig = loadConfigFromEnv();
    
    // Merge configurations (env variables take precedence over file)
    if (!fileConfig && !envConfig) {
      return null;
    }
    
    if (!fileConfig) {
      return envConfig;
    }
    
    if (!envConfig) {
      return fileConfig;
    }
    
    // Merge: env config overrides file config
    return {
      ...fileConfig,
      ...envConfig,
      // Special handling for providers: merge arrays
      providers: [
        ...(fileConfig.providers || []),
        ...(envConfig.providers || []),
      ],
      // Special handling for direct: merge arrays and deduplicate
      direct: Array.from(new Set([
        ...(fileConfig.direct || []),
        ...(envConfig.direct || []),
      ])),
    };
  } catch (error) {
    console.error(`[opencode-proxy] Failed to load config from ${configPath}:`, error);
    // Try to fall back to env config only
    return loadConfigFromEnv();
  }
}

export function validateConfig(config: ProxyPluginConfig | null | undefined): boolean {
  if (!config) return false;
  
  if (config.providers) {
    for (const provider of config.providers) {
      if (!provider.provider) {
        console.error("[opencode-proxy] Provider config missing 'provider' field");
        return false;
      }
      if (!isValidProxyConfig(provider)) {
        return false;
      }
    }
  }
  
  if (config.defaultProxy && !isValidProxyConfig(config.defaultProxy)) {
    return false;
  }
  
  return true;
}

function isValidProxyConfig(config: ProxyConfig): boolean {
  if (config.protocol === "direct") {
    return true;
  }
  
  if (!config.host) {
    console.error("[opencode-proxy] Proxy config missing 'host' field");
    return false;
  }
  
  if (!config.port || config.port < 1 || config.port > 65535) {
    console.error("[opencode-proxy] Proxy config has invalid 'port' field");
    return false;
  }
  
  const validProtocols = ["http", "https", "socks", "socks4", "socks5"];
  if (!validProtocols.includes(config.protocol)) {
    console.error(`[opencode-proxy] Invalid protocol: ${config.protocol}`);
    return false;
  }
  
  return true;
}

export function getProxyForProvider(
  config: ProxyPluginConfig,
  providerID: string
): ProxyConfig | null | undefined {
  // Check direct list first - these providers bypass proxy entirely
  if (config.direct?.includes(providerID)) {
    return { protocol: "direct" };
  }

  const providerConfig = config.providers?.find((p) => {
    if (p.provider === providerID) return true;
    if (p.matchSubProviders && providerID.startsWith(p.provider)) return true;
    return false;
  });

  if (providerConfig) {
    const { provider: _, matchSubProviders: __, ...proxyConfig } = providerConfig;
    // Check if this provider config is set to direct
    if (proxyConfig.protocol === "direct") {
      return proxyConfig;
    }
    return proxyConfig;
  }

  return config.defaultProxy;
}

export function shouldUseProxy(config: ProxyPluginConfig | null): boolean {
  if (!config) return false;
  return !!(config.providers?.length || config.defaultProxy);
}

/**
 * Watch configuration file for changes
 * @param callback Function to call when config changes
 * @returns Function to stop watching
 */
export function watchConfig(callback: (config: ProxyPluginConfig | null) => void): () => void {
  const configPath = getConfigPath();
  
  // Check if fs.watchFile is available (not available in all environments)
  if (typeof fs.watchFile !== 'function') {
    console.warn('[opencode-proxy] Config file watching not supported in this environment');
    return () => {};
  }
  
  // Watch the config file for changes
  fs.watchFile(configPath, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      console.log('[opencode-proxy] Config file changed, reloading...');
      const newConfig = loadConfig();
      callback(newConfig);
    }
  });
  
  // Return unwatch function
  return () => {
    fs.unwatchFile(configPath);
  };
}

/**
 * Watch environment variables (poll-based, checks every 5 seconds)
 * Note: Environment variables typically don't change at runtime,
 * but this is useful for container environments
 */
export function watchEnvVariables(callback: (config: ProxyPluginConfig | null) => void): () => void {
  let lastConfig = JSON.stringify(loadConfigFromEnv());
  
  const interval = setInterval(() => {
    const currentConfig = JSON.stringify(loadConfigFromEnv());
    if (currentConfig !== lastConfig) {
      console.log('[opencode-proxy] Environment config changed, reloading...');
      lastConfig = currentConfig;
      callback(loadConfig());
    }
  }, 5000);
  
  return () => {
    clearInterval(interval);
  };
}
