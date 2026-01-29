# OpenCode Proxy

Per-provider proxy configuration for OpenCode. Route different AI providers through different proxies with fine-grained control.

## Why?

OpenCode uses global `HTTP_PROXY`/`HTTPS_PROXY` environment variables that apply to all providers. This plugin allows you to:

- Route Google/Gemini through a specific proxy (e.g., `127.0.0.1:20171`)
- Connect directly to Kimi/Moonshot (no proxy)
- Use different proxies for different providers based on your network requirements
- Support HTTP, HTTPS, and SOCKS proxies

## Features

- Per-provider proxy configuration
- Support for HTTP, HTTPS, SOCKS4, and SOCKS5 proxies
- Direct connection mode (bypass proxy for specific providers)
- Sub-provider matching (e.g., `google` matches `google-vertex`)
- Debug logging for troubleshooting
- Compatible with `opencode-antigravity-auth` and `oh-my-opencode`

## Installation

### 1. Install the Plugin

```bash
npm install opencode-proxy
```

Or add it to your OpenCode configuration:

```bash
opencode config add plugin opencode-proxy
```

### 2. Configure OpenCode

Add the plugin to your `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-proxy"]
}
```

### 3. Create Proxy Configuration

Create `~/.config/opencode/proxy.json`:

```json
{
  "providers": [
    {
      "provider": "google",
      "protocol": "http",
      "host": "127.0.0.1",
      "port": 20171
    },
    {
      "provider": "anthropic",
      "protocol": "socks5",
      "host": "127.0.0.1",
      "port": 1080,
      "username": "user",
      "password": "pass"
    }
  ],
  "direct": ["moonshot", "kimi"]
}
```

## Configuration

### Configuration File Location

The plugin looks for configuration at:
- `$XDG_CONFIG_HOME/opencode/proxy.json`
- `~/.config/opencode/proxy.json` (default)

### Configuration Schema

```json
{
  "version": "1",
  "debug": false,
  "timeout": 30000,
  "defaultProxy": {
    "protocol": "http",
    "host": "127.0.0.1",
    "port": 8080,
    "username": "optional",
    "password": "optional"
  },
  "providers": [
    {
      "provider": "google",
      "protocol": "http",
      "host": "127.0.0.1",
      "port": 20171,
      "matchSubProviders": true
    }
  ],
  "direct": ["moonshot", "kimi"]
}
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `version` | string | Config format version (default: "1") |
| `debug` | boolean | Enable debug logging |
| `timeout` | number | Connection timeout in milliseconds |
| `defaultProxy` | ProxyConfig | Default proxy for providers without specific config |
| `providers` | ProviderProxyConfig[] | Provider-specific proxy configurations |
| `direct` | string[] | List of provider IDs to connect directly (no proxy) |

### ProxyConfig Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `protocol` | string | Yes | Proxy protocol: `http`, `https`, `socks`, `socks4`, `socks5`, `direct` |
| `host` | string | Yes* | Proxy hostname or IP |
| `port` | number | Yes* | Proxy port (1-65535) |
| `username` | string | No | Username for proxy authentication |
| `password` | string | No | Password for proxy authentication |
| `headers` | object | No | Additional headers for proxy connection |

*Required unless `protocol` is `direct`

### ProviderProxyConfig Options

Extends `ProxyConfig` with:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `provider` | string | Yes | Provider ID to match (e.g., "google", "anthropic") |
| `matchSubProviders` | boolean | No | Match sub-providers (e.g., "google" matches "google-vertex") |

## Supported Providers

The following provider IDs are supported:

- `google` - Google Gemini API
- `google-vertex` - Google Vertex AI
- `google-vertex-anthropic` - Anthropic on Vertex AI
- `anthropic` - Anthropic Claude API
- `openai` - OpenAI API
- `azure` - Azure OpenAI
- `amazon-bedrock` - AWS Bedrock
- `moonshot` / `kimi` - Moonshot AI (Kimi)
- `deepseek` - DeepSeek AI
- `groq` - Groq
- `mistral` - Mistral AI
- `cohere` - Cohere
- `together` - Together AI
- `perplexity` - Perplexity
- `openrouter` - OpenRouter
- `github-copilot` - GitHub Copilot
- `github-copilot-enterprise` - GitHub Copilot Enterprise
- `xai` - xAI (Grok)
- `cerebras` - Cerebras
- `fireworks` - Fireworks AI

You can also use any custom provider ID that OpenCode supports.

## Examples

### Example 1: Route Google through Local Proxy

```json
{
  "providers": [
    {
      "provider": "google",
      "protocol": "http",
      "host": "127.0.0.1",
      "port": 20171
    }
  ]
}
```

### Example 2: Use SOCKS5 Proxy for All Providers Except Specific Ones

```json
{
  "defaultProxy": {
    "protocol": "socks5",
    "host": "127.0.0.1",
    "port": 1080
  },
  "direct": ["moonshot", "kimi"]
}
```

### Example 3: Different Proxies for Different Providers

```json
{
  "providers": [
    {
      "provider": "google",
      "protocol": "http",
      "host": "proxy1.example.com",
      "port": 8080
    },
    {
      "provider": "anthropic",
      "protocol": "https",
      "host": "proxy2.example.com",
      "port": 8443,
      "username": "user",
      "password": "pass"
    },
    {
      "provider": "openai",
      "protocol": "socks5",
      "host": "127.0.0.1",
      "port": 1080
    }
  ],
  "direct": ["groq", "mistral"]
}
```

### Example 4: Sub-Provider Matching

```json
{
  "providers": [
    {
      "provider": "google",
      "protocol": "http",
      "host": "127.0.0.1",
      "port": 20171,
      "matchSubProviders": true
    }
  ]
}
```

This configuration will match:
- `google`
- `google-vertex`
- `google-vertex-anthropic`

### Example 5: Debug Mode

```json
{
  "debug": true,
  "providers": [
    {
      "provider": "google",
      "protocol": "http",
      "host": "127.0.0.1",
      "port": 20171
    }
  ]
}
```

With debug mode enabled, you'll see logs like:
```
[opencode-proxy] Processing request for provider: google
[opencode-proxy] Using proxy for provider: google { protocol: 'http', host: '127.0.0.1', port: 20171 }
[opencode-proxy] Successfully injected proxied fetch for: google
```

## How It Works

The plugin uses OpenCode's `chat.params` hook to intercept outgoing requests to AI providers. When a request is made:

1. The plugin identifies the provider from the request
2. Looks up the proxy configuration for that provider
3. Creates an appropriate proxy agent (HTTP, HTTPS, or SOCKS)
4. Injects the proxied `fetch` function into the request options
5. The AI SDK uses the proxied fetch to route requests through the configured proxy

## Compatibility

- OpenCode >= 1.0.0
- Compatible with `opencode-antigravity-auth`
- Compatible with `oh-my-opencode`
- Works with all AI providers supported by OpenCode

## Troubleshooting

### Enable Debug Logging

Set `debug: true` in your `proxy.json` to see detailed logs.

### Check Configuration

Validate your configuration file:

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.HOME + '/.config/opencode/proxy.json')))"
```

### Common Issues

**Plugin not working:**
- Ensure the plugin is listed in `~/.config/opencode/opencode.json`
- Check that `proxy.json` exists and is valid JSON
- Enable debug mode to see what's happening

**Connection timeouts:**
- Increase the `timeout` value in your config
- Check that your proxy is running and accessible
- Verify proxy host and port are correct

**Authentication failures:**
- Ensure username/password are correctly specified
- Check if your proxy requires URL-encoded credentials

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/opencode-proxy.git
cd opencode-proxy

# Install dependencies
npm install

# Build
npm run build

# Type check
npm run typecheck
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for [OpenCode](https://opencode.ai)
- Inspired by the need for fine-grained proxy control in AI development workflows
