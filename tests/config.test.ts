import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import {
  getConfigPath,
  loadConfig,
  validateConfig,
  parseProxyUrl,
  getProxyForProvider,
  shouldUseProxy,
  getConfiguredProviders,
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

  describe('parseProxyUrl', () => {
    it('should parse simple http URL', () => {
      const result = parseProxyUrl('http://127.0.0.1:20171');
      expect(result).toEqual({
        protocol: 'http',
        host: '127.0.0.1',
        port: 20171,
      });
    });

    it('should parse URL with auth', () => {
      const result = parseProxyUrl('http://user:pass@proxy.example.com:8080');
      expect(result).toEqual({
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
        username: 'user',
        password: 'pass',
      });
    });

    it('should parse socks5 URL', () => {
      const result = parseProxyUrl('socks5://127.0.0.1:1080');
      expect(result).toEqual({
        protocol: 'socks5',
        host: '127.0.0.1',
        port: 1080,
      });
    });

    it('should parse socks URL (treated as socks5)', () => {
      const result = parseProxyUrl('socks://127.0.0.1:1080');
      expect(result).toEqual({
        protocol: 'socks',
        host: '127.0.0.1',
        port: 1080,
      });
    });

    it('should return null for invalid URL', () => {
      const result = parseProxyUrl('not-a-valid-url');
      expect(result).toBeNull();
    });

    it('should return null for invalid port', () => {
      const result = parseProxyUrl('http://127.0.0.1:99999');
      expect(result).toBeNull();
    });

    it('should return null for unsupported protocol', () => {
      const result = parseProxyUrl('ftp://127.0.0.1:8080');
      expect(result).toBeNull();
    });

    it('should handle URL-encoded credentials', () => {
      const result = parseProxyUrl('http://user%40domain:p%40ss@proxy.com:8080');
      expect(result).toEqual({
        protocol: 'http',
        host: 'proxy.com',
        port: 8080,
        username: 'user@domain',
        password: 'p@ss',
      });
    });
  });

  describe('validateConfig', () => {
    it('should return false for null config', () => {
      expect(validateConfig(null as any)).toBe(false);
    });

    it('should return true for valid config with single provider', () => {
      const config = {
        google: 'http://127.0.0.1:20171',
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should return true for valid config with debug', () => {
      const config = {
        debug: true,
        google: 'http://127.0.0.1:20171',
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should return true for multiple providers', () => {
      const config = {
        google: 'http://127.0.0.1:20171',
        openai: 'socks5://127.0.0.1:1080',
        anthropic: 'https://proxy.example.com:8443',
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should return false for invalid proxy URL', () => {
      const config = {
        google: 'not-a-valid-url',
      };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(validateConfig(config)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[opencode-proxy] Invalid proxy URL for 'google': not-a-valid-url"
      );
      consoleSpy.mockRestore();
    });

    it('should return false when debug is not boolean', () => {
      const config = {
        debug: 'yes',
      };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(validateConfig(config)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[opencode-proxy] Invalid value for 'debug': expected boolean"
      );
      consoleSpy.mockRestore();
    });

    it('should return false for non-string provider value', () => {
      const config = {
        google: { protocol: 'http', host: '127.0.0.1', port: 8080 },
      };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(validateConfig(config)).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[opencode-proxy] Invalid value for 'google': expected string URL"
      );
      consoleSpy.mockRestore();
    });

    it('should return false for unsupported protocol', () => {
      const config = {
        google: 'ftp://127.0.0.1:8080',
      };
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(validateConfig(config)).toBe(false);
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
      const mockConfig = {
        debug: true,
        google: 'http://127.0.0.1:20171',
        openai: 'socks5://127.0.0.1:1080',
      };
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

      const config = loadConfig();
      expect(config).toEqual(mockConfig);
    });

    it('should return null for invalid config', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        google: 'invalid-url',
      }));

      const config = loadConfig();
      expect(config).toBeNull();
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
    it('should return proxy config for configured provider', () => {
      const config: ProxyPluginConfig = {
        google: 'http://127.0.0.1:20171',
      };

      const result = getProxyForProvider(config, 'google');
      expect(result).toEqual({
        protocol: 'http',
        host: '127.0.0.1',
        port: 20171,
      });
    });

    it('should return proxy config with auth', () => {
      const config: ProxyPluginConfig = {
        anthropic: 'http://user:pass@proxy.example.com:8080',
      };

      const result = getProxyForProvider(config, 'anthropic');
      expect(result).toEqual({
        protocol: 'http',
        host: 'proxy.example.com',
        port: 8080,
        username: 'user',
        password: 'pass',
      });
    });

    it('should return null for unconfigured provider (direct)', () => {
      const config: ProxyPluginConfig = {
        google: 'http://127.0.0.1:20171',
      };

      const result = getProxyForProvider(config, 'anthropic');
      expect(result).toBeNull();
    });

    it('should return socks5 config', () => {
      const config: ProxyPluginConfig = {
        openai: 'socks5://127.0.0.1:1080',
      };

      const result = getProxyForProvider(config, 'openai');
      expect(result).toEqual({
        protocol: 'socks5',
        host: '127.0.0.1',
        port: 1080,
      });
    });

    it('should handle https protocol', () => {
      const config: ProxyPluginConfig = {
        azure: 'https://secure-proxy.example.com:8443',
      };

      const result = getProxyForProvider(config, 'azure');
      expect(result).toEqual({
        protocol: 'https',
        host: 'secure-proxy.example.com',
        port: 8443,
      });
    });
  });

  describe('shouldUseProxy', () => {
    it('should return false when config is null', () => {
      expect(shouldUseProxy(null)).toBe(false);
    });

    it('should return false when only debug is set', () => {
      const config: ProxyPluginConfig = {
        debug: true,
      };
      expect(shouldUseProxy(config)).toBe(false);
    });

    it('should return true when provider is configured', () => {
      const config: ProxyPluginConfig = {
        google: 'http://127.0.0.1:20171',
      };
      expect(shouldUseProxy(config)).toBe(true);
    });

    it('should return true when multiple providers are configured', () => {
      const config: ProxyPluginConfig = {
        google: 'http://127.0.0.1:20171',
        openai: 'socks5://127.0.0.1:1080',
        debug: true,
      };
      expect(shouldUseProxy(config)).toBe(true);
    });
  });

  describe('getConfiguredProviders', () => {
    it('should return empty array for empty config', () => {
      const config: ProxyPluginConfig = {};
      expect(getConfiguredProviders(config)).toEqual([]);
    });

    it('should return provider names excluding debug', () => {
      const config: ProxyPluginConfig = {
        debug: true,
        google: 'http://127.0.0.1:20171',
        openai: 'socks5://127.0.0.1:1080',
      };
      const providers = getConfiguredProviders(config);
      expect(providers).toContain('google');
      expect(providers).toContain('openai');
      expect(providers).not.toContain('debug');
      expect(providers.length).toBe(2);
    });

    it('should return all providers when no debug', () => {
      const config: ProxyPluginConfig = {
        google: 'http://127.0.0.1:20171',
        anthropic: 'http://proxy.example.com:8080',
      };
      const providers = getConfiguredProviders(config);
      expect(providers.sort()).toEqual(['anthropic', 'google']);
    });
  });
});
