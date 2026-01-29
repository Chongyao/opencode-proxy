/**
 * Configuration types for opencode-proxy
 * New simplified format: { "google": "http://127.0.0.1:20171", "openai": "socks5://127.0.0.1:1080" }
 * Unconfigured providers connect directly by default.
 */

export type ProxyProtocol = "http" | "https" | "socks" | "socks4" | "socks5";

export interface ProxyConfig {
  /** The proxy protocol to use */
  protocol: ProxyProtocol;
  /** Proxy host */
  host: string;
  /** Proxy port */
  port: number;
  /** Username for proxy authentication */
  username?: string;
  /** Password for proxy authentication */
  password?: string;
}

/**
 * Simplified proxy configuration.
 * Each key is a provider ID, value is a proxy URL.
 * Unconfigured providers connect directly.
 */
export interface ProxyPluginConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Proxy URL for each provider. Format: protocol://[username:password@]host:port */
  [provider: string]: string | boolean | undefined;
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
  "github-copilot-enterprise": ["api.githubcopilot.com", "copilot-proxy.githubusercontent.com"],
  xai: ["api.x.ai"],
  cerebras: ["api.cerebras.ai"],
  fireworks: ["api.fireworks.ai"],
};
