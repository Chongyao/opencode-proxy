import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ProxyPluginConfig, ProxyConfig } from "./types.js";

const CONFIG_FILENAME = "proxy.json";
const CONFIG_DIR = "opencode";

export function getConfigPath(): string {
  const configDir = process.env.XDG_CONFIG_HOME
    ?? path.join(os.homedir(), ".config");
  return path.join(configDir, CONFIG_DIR, CONFIG_FILENAME);
}

/**
 * Parse proxy URL string into ProxyConfig
 * Format: protocol://[username:password@]host:port
 */
export function parseProxyUrl(url: string): ProxyConfig | null {
  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.replace(':', '') as ProxyConfig['protocol'];
    const port = parseInt(parsed.port, 10);

    if (!port || port < 1 || port > 65535) {
      return null;
    }

    const validProtocols = ["http", "https", "socks", "socks4", "socks5"];
    if (!validProtocols.includes(protocol)) {
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
 * Load configuration from file
 */
export function loadConfig(): ProxyPluginConfig | null {
  const configPath = getConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      return null;
    }

    const content = fs.readFileSync(configPath, "utf-8");
    const rawConfig = JSON.parse(content) as Record<string, unknown>;

    if (!validateConfig(rawConfig)) {
      return null;
    }

    // Build typed config
    const config: ProxyPluginConfig = {};

    for (const [key, value] of Object.entries(rawConfig)) {
      if (key === 'debug' && typeof value === 'boolean') {
        config.debug = value;
      } else if (typeof value === 'string') {
        config[key] = value;
      }
    }

    return config;
  } catch (error) {
    console.error(`[opencode-proxy] Failed to load config from ${configPath}:`, error);
    return null;
  }
}

/**
 * Validate raw config object from JSON
 */
export function validateConfig(config: Record<string, unknown> | null): boolean {
  if (!config || typeof config !== 'object') {
    return false;
  }

  // Check that all string values are valid proxy URLs
  for (const [key, value] of Object.entries(config)) {
    if (key === 'debug') {
      if (typeof value !== 'boolean') {
        console.error(`[opencode-proxy] Invalid value for 'debug': expected boolean`);
        return false;
      }
      continue;
    }

    if (typeof value !== 'string') {
      console.error(`[opencode-proxy] Invalid value for '${key}': expected string URL`);
      return false;
    }

    if (!parseProxyUrl(value)) {
      console.error(`[opencode-proxy] Invalid proxy URL for '${key}': ${value}`);
      return false;
    }
  }

  return true;
}

/**
 * Get proxy configuration for a provider
 * Returns null if provider should connect directly (not configured)
 * Returns ProxyConfig if provider has a proxy configured
 */
export function getProxyForProvider(
  config: ProxyPluginConfig,
  providerID: string
): ProxyConfig | null {
  const proxyUrl = config[providerID];

  if (typeof proxyUrl !== 'string') {
    // Provider not configured = direct connection
    return null;
  }

  return parseProxyUrl(proxyUrl);
}

/**
 * Check if plugin should be active (any provider configured)
 */
export function shouldUseProxy(config: ProxyPluginConfig | null): boolean {
  if (!config) return false;

  // Check if any provider is configured (excluding 'debug')
  return Object.keys(config).some(key => key !== 'debug' && typeof config[key] === 'string');
}

/**
 * Get all configured providers
 */
export function getConfiguredProviders(config: ProxyPluginConfig): string[] {
  return Object.keys(config).filter(key => key !== 'debug' && typeof config[key] === 'string');
}

/**
 * Watch configuration file for changes
 */
export function watchConfig(callback: (config: ProxyPluginConfig | null) => void): () => void {
  const configPath = getConfigPath();

  if (typeof fs.watchFile !== 'function') {
    console.warn('[opencode-proxy] Config file watching not supported in this environment');
    return () => {};
  }

  fs.watchFile(configPath, { interval: 1000 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      console.log('[opencode-proxy] Config file changed, reloading...');
      callback(loadConfig());
    }
  });

  return () => {
    fs.unwatchFile(configPath);
  };
}
