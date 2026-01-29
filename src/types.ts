/**
 * Configuration types for opencode-proxy
 */

export type ProxyProtocol = "http" | "https" | "socks" | "socks4" | "socks5" | "direct";

export interface ProxyConfig {
  /** The proxy protocol to use */
  protocol: ProxyProtocol;
  /** Proxy host (ignored for direct) */
  host?: string;
  /** Proxy port (ignored for direct) */
  port?: number;
  /** Username for proxy authentication */
  username?: string;
  /** Password for proxy authentication */
  password?: string;
  /** Additional headers to send to the proxy */
  headers?: Record<string, string>;
}

export interface ProviderProxyConfig extends ProxyConfig {
  /** Provider ID to match (e.g., "google", "anthropic", "openai") */
  provider: string;
  /** Whether to match sub-providers (e.g., "google-vertex" matches "google") */
  matchSubProviders?: boolean;
}

export interface ProxyPluginConfig {
  /** Version of the config format */
  version?: "1";
  /** Default proxy to use when no provider-specific proxy is configured */
  defaultProxy?: ProxyConfig;
  /** Provider-specific proxy configurations */
  providers?: ProviderProxyConfig[];
  /** Enable debug logging */
  debug?: boolean;
  /** Timeout for proxy connections in milliseconds */
  timeout?: number;
}

/** Provider ID patterns that can be matched */
export type KnownProvider = 
  | "google"
  | "anthropic" 
  | "openai"
  | "azure"
  | "amazon-bedrock"
  | "moonshot"
  | "kimi"
  | "deepseek"
  | "groq"
  | "mistral"
  | "cohere"
  | "together"
  | "perplexity"
  | "openrouter"
  | "github-copilot"
  | "github-copilot-enterprise"
  | "vertex"
  | "google-vertex"
  | "google-vertex-anthropic"
  | "xai"
  | "cerebras"
  | "fireworks"
  | string; // Allow any custom provider

/** Built-in provider URL patterns for detection */
export const PROVIDER_URL_PATTERNS: Record<string, string[]> = {
  google: ["generativelanguage.googleapis.com", "ai.google.dev"],
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
  "github-copilot-enterprise": ["api.githubcopilot.com", "copilot-proxy.githubusercontent.com"],
  xai: ["api.x.ai"],
  cerebras: ["api.cerebras.ai"],
  fireworks: ["api.fireworks.ai"],
};
