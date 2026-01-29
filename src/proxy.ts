import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import type { ProxyConfig } from "./types.js";

export interface ProxyAgent {
  httpAgent: HttpProxyAgent<string>;
  httpsAgent: HttpsProxyAgent<string> | SocksProxyAgent;
  protocol: string;
}

export function createProxyAgent(config: ProxyConfig): ProxyAgent | null {
  if (config.protocol === "direct") {
    return null;
  }

  const proxyUrl = buildProxyUrl(config);
  
  switch (config.protocol) {
    case "http":
      return {
        httpAgent: new HttpProxyAgent(proxyUrl),
        httpsAgent: new HttpsProxyAgent(proxyUrl),
        protocol: "http",
      };
    case "https":
      return {
        httpAgent: new HttpProxyAgent(proxyUrl),
        httpsAgent: new HttpsProxyAgent(proxyUrl),
        protocol: "https",
      };
    case "socks":
    case "socks4":
    case "socks5": {
      const socksAgent = new SocksProxyAgent(proxyUrl);
      return {
        httpAgent: socksAgent as unknown as HttpProxyAgent<string>,
        httpsAgent: socksAgent,
        protocol: config.protocol,
      };
    }
    default:
      console.warn(`[opencode-proxy] Unsupported proxy protocol: ${config.protocol}`);
      return null;
  }
}

function buildProxyUrl(config: ProxyConfig): string {
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

export function createProxiedFetch(
  proxyAgent: ProxyAgent | null,
  originalFetch: typeof fetch
): typeof fetch {
  if (!proxyAgent) {
    return originalFetch;
  }

  return async (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    let url: string;
    
    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.url;
    }

    const isHttps = url.startsWith("https://");
    const agent = isHttps ? proxyAgent.httpsAgent : proxyAgent.httpAgent;
    
    return originalFetch(input, {
      ...init,
      dispatcher: agent as any,
    });
  };
}
