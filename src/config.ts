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

export function loadConfig(): ProxyPluginConfig | null {
  const configPath = getConfigPath();
  
  try {
    if (!fs.existsSync(configPath)) {
      return null;
    }
    
    const content = fs.readFileSync(configPath, "utf-8");
    const config: ProxyPluginConfig = JSON.parse(content);
    
    return validateConfig(config) ? config : null;
  } catch (error) {
    console.error(`[opencode-proxy] Failed to load config from ${configPath}:`, error);
    return null;
  }
}

export function validateConfig(config: ProxyPluginConfig): boolean {
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
    return proxyConfig;
  }
  
  return config.defaultProxy;
}

export function shouldUseProxy(config: ProxyPluginConfig | null): boolean {
  if (!config) return false;
  return !!(config.providers?.length || config.defaultProxy || config.direct?.length);
}
