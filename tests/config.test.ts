import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  getConfigPath,
  loadConfig,
  validateConfig,
  getProxyForProvider,
  shouldUseProxy,
} from '../src/config.js';
import type { ProxyPluginConfig } from '../src/types.js';

// Mock fs and os modules
vi.mock('fs');
vi.mock('os');

describe('config', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.XDG_CONFIG_HOME;
    vi.mocked(os.homedir).mockReturnValue('/home/user');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getConfigPath', () => {
    it('should use XDG_CONFIG_HOME if set', () => {
      process.env.XDG_CONFIG_HOME = '/xdg/config';
      const configPath = getConfigPath();
      expect(configPath).toBe('/xdg/config/opencode/proxy.json');
    });

    it('should fall back to ~/.config if XDG_CONFIG_HOME not set', () => {
      vi.mocked(os.homedir).mockReturnValue('/home/user');
      const configPath = getConfigPath();
      expect(configPath).toBe('/home/user/.config/opencode/proxy.json');
    });
  });

  describe('validateConfig', () => {
    it('should return false for null config', () => {
      expect(validateConfig(null as any)).toBe(false);
    });

    it('should return true for valid config with providers', () => {
      const config: ProxyPluginConfig = {
        providers: [
          { provider: 'google', protocol: 'http', host: '127.0.0.1', port: 8080 },
        ],
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should return true for valid config with defaultProxy', () => {
      const config: ProxyPluginConfig = {
        defaultProxy: { protocol: 'socks5', host: '127.0.0.1', port: 1080 },
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should return true for direct protocol without host/port', () => {
      const config: ProxyPluginConfig = {
        providers: [
          { provider: 'azure', protocol: 'direct' },
        ],
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should return false when provider config missing provider field', () => {
      const config: ProxyPluginConfig = {
        providers: [
          { protocol: 'http', host: '127.0.0.1', port: 8080 } as any,
        ],
      };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(validateConfig(config)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[opencode-proxy] Provider config missing \'provider\' field'
      );
      consoleSpy.mockRestore();
    });

    it('should return false when proxy config missing host', () => {
      const config: ProxyPluginConfig = {
        providers: [
          { provider: 'google', protocol: 'http', port: 8080 } as any,
        ],
      };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(validateConfig(config)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[opencode-proxy] Proxy config missing \'host\' field'
      );
      consoleSpy.mockRestore();
    });

    it('should return false when proxy config has invalid port', () => {
      const config: ProxyPluginConfig = {
        providers: [
          { provider: 'google', protocol: 'http', host: '127.0.0.1', port: 99999 },
        ],
      };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(validateConfig(config)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[opencode-proxy] Proxy config has invalid \'port\' field'
      );
      consoleSpy.mockRestore();
    });

    it('should return false for invalid protocol', () => {
      const config: ProxyPluginConfig = {
        providers: [
          { provider: 'google', protocol: 'invalid', host: '127.0.0.1', port: 8080 } as any,
        ],
      };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(validateConfig(config)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[opencode-proxy] Invalid protocol: invalid'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('loadConfig', () => {
    it('should return null if config file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const config = loadConfig();
      expect(config).toBeNull();
    });

    it('should load and parse valid config file', () => {
      const mockConfig: ProxyPluginConfig = {
        debug: true,
        providers: [
          { provider: 'google', protocol: 'http', host: '127.0.0.1', port: 8080 },
        ],
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));
      
      const config = loadConfig();
      expect(config).toEqual(mockConfig);
    });

    it('should return null and log error for invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const config = loadConfig();
      expect(config).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('getProxyForProvider', () => {
    it('should return direct config for provider in direct list', () => {
      const config: ProxyPluginConfig = {
        providers: [
          { provider: 'google', protocol: 'http', host: '127.0.0.1', port: 8080 },
        ],
        direct: ['moonshot', 'kimi'],
      };
      
      const result = getProxyForProvider(config, 'moonshot');
      expect(result).toEqual({ protocol: 'direct' });
    });

    it('should return provider-specific config', () => {
      const config: ProxyPluginConfig = {
        providers: [
          { provider: 'google', protocol: 'http', host: '127.0.0.1', port: 8080 },
          { provider: 'anthropic', protocol: 'socks5', host: '127.0.0.1', port: 1080 },
        ],
      };
      
      const result = getProxyForProvider(config, 'google');
      expect(result).toEqual({ protocol: 'http', host: '127.0.0.1', port: 8080 });
    });

    it('should match sub-providers when matchSubProviders is true', () => {
      const config: ProxyPluginConfig = {
        providers: [
          { provider: 'google', protocol: 'http', host: '127.0.0.1', port: 8080, matchSubProviders: true },
        ],
      };
      
      const result = getProxyForProvider(config, 'google-vertex');
      expect(result).toEqual({ protocol: 'http', host: '127.0.0.1', port: 8080 });
    });

    it('should return defaultProxy when no provider-specific config', () => {
      const config: ProxyPluginConfig = {
        defaultProxy: { protocol: 'socks5', host: '127.0.0.1', port: 1080 },
        providers: [
          { provider: 'google', protocol: 'http', host: '127.0.0.1', port: 8080 },
        ],
      };
      
      const result = getProxyForProvider(config, 'openai');
      expect(result).toEqual({ protocol: 'socks5', host: '127.0.0.1', port: 1080 });
    });

    it('should return undefined when no matching config', () => {
      const config: ProxyPluginConfig = {
        providers: [
          { provider: 'google', protocol: 'http', host: '127.0.0.1', port: 8080 },
        ],
      };
      
      const result = getProxyForProvider(config, 'openai');
      expect(result).toBeUndefined();
    });

    it('should return direct config when provider has direct protocol', () => {
      const config: ProxyPluginConfig = {
        providers: [
          { provider: 'azure', protocol: 'direct' },
        ],
      };
      
      const result = getProxyForProvider(config, 'azure');
      expect(result).toEqual({ protocol: 'direct' });
    });
  });

  describe('shouldUseProxy', () => {
    it('should return false when config is null', () => {
      expect(shouldUseProxy(null)).toBe(false);
    });

    it('should return false when no providers or defaultProxy', () => {
      const config: ProxyPluginConfig = {};
      expect(shouldUseProxy(config)).toBe(false);
    });

    it('should return true when providers exist', () => {
      const config: ProxyPluginConfig = {
        providers: [
          { provider: 'google', protocol: 'http', host: '127.0.0.1', port: 8080 },
        ],
      };
      expect(shouldUseProxy(config)).toBe(true);
    });

    it('should return true when defaultProxy exists', () => {
      const config: ProxyPluginConfig = {
        defaultProxy: { protocol: 'socks5', host: '127.0.0.1', port: 1080 },
      };
      expect(shouldUseProxy(config)).toBe(true);
    });
  });
});
