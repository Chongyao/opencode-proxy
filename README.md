# OpenCode Proxy

Per-provider proxy configuration for OpenCode. Route different AI providers through different proxies with a simple, concise configuration.

## Why?

OpenCode uses global `HTTP_PROXY`/`HTTPS_PROXY` environment variables that apply to all providers. This plugin allows you to:

- Route Google/Gemini through a specific proxy (e.g., `127.0.0.1:20171`)
- Connect directly to Kimi/Moonshot (no proxy)
- Use different proxies for different providers based on your network requirements
- Support HTTP, HTTPS, and SOCKS proxies

## Features

- **Simple URL-based configuration** - Just specify `provider: "proxy-url"`
- **Direct by default** - Unconfigured providers connect directly (no proxy)
- **Multiple proxy protocols** - Support for HTTP, HTTPS, SOCKS4, and SOCKS5 proxies
- **Built-in auth support** - URL-encoded username/password in proxy URL
- **Debug logging** - Detailed logs for troubleshooting
- **Configuration hot reload** - Changes to `proxy.json` are automatically picked up

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
  "debug": true,
  "google": "http://127.0.0.1:20171",
  "openai": "socks5://127.0.0.1:1080"
}
```

**That's it!** Any provider not listed (like `moonshot`, `kimi`, `anthropic`) will connect directly without a proxy.

## Configuration

### Configuration File Location

The plugin looks for configuration at:
- `$XDG_CONFIG_HOME/opencode/proxy.json`
- `~/.config/opencode/proxy.json` (default)

### Configuration Format

```json
{
  "debug": true,
  "google": "http://127.0.0.1:20171",
  "anthropic": "socks5://user:pass@127.0.0.1:1080",
  "openai": "https://proxy.example.com:8443"
}
```

### Configuration Options

| Key | Type | Description |
|-----|------|-------------|
| `debug` | boolean | Enable debug logging (optional) |
| `<provider>` | string | Proxy URL for the provider (optional) |

**Proxy URL format:** `protocol://[username:password@]host:port`

### Supported Protocols

| Protocol | Example |
|----------|---------|
| HTTP | `http://127.0.0.1:8080` |
| HTTPS | `https://proxy.example.com:8443` |
| SOCKS | `socks://127.0.0.1:1080` |
| SOCKS4 | `socks4://127.0.0.1:1080` |
| SOCKS5 | `socks5://127.0.0.1:1080` |

### Supported Providers

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

### Example 1: Route Only Google through Proxy

```json
{
  "google": "http://127.0.0.1:20171"
}
```

Only Google Gemini goes through the proxy. All other providers connect directly.

### Example 2: Multiple Providers with Different Proxies

```json
{
  "google": "http://127.0.0.1:20171",
  "openai": "socks5://127.0.0.1:1080",
  "anthropic": "https://proxy.example.com:8443"
}
```

### Example 3: Proxy with Authentication

```json
{
  "google": "http://user:password@proxy.example.com:8080",
  "anthropic": "socks5://user:pass@127.0.0.1:1080"
}
```

For special characters in credentials, use URL encoding:
```json
{
  "google": "http://user%40domain:p%40ssword@proxy.com:8080"
}
```

### Example 4: Debug Mode

```json
{
  "debug": true,
  "google": "http://127.0.0.1:20171"
}
```

With debug mode enabled, you'll see logs like:
```
[opencode-proxy] Initialized: { providers: ['google'], patterns: 3 }
[opencode-proxy] Fetch patched
[opencode-proxy] Proxy: https://generativelanguage.googleapis.com/v1beta/models -> http://127.0.0.1:20171
[opencode-proxy] Direct: https://api.moonshot.cn/v1/models
```

### Example 5: Minimal Configuration

```json
{
  "google": "http://127.0.0.1:20171"
}
```

Moonshot, Kimi, and all other providers not listed will connect directly.

## How It Works

The plugin patches the global `fetch` function to intercept outgoing requests to AI providers. When a request is made:

1. The plugin identifies the provider from the request URL
2. If the provider is configured with a proxy URL, the request is routed through that proxy
3. If the provider is not configured, the request connects directly (no proxy)

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
- Check that your proxy is running and accessible
- Verify proxy host and port are correct

**Authentication failures:**
- Ensure username/password are correctly URL-encoded if they contain special characters

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

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Format code
npm run format
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for [OpenCode](https://opencode.ai)
- Inspired by the need for fine-grained proxy control in AI development workflows
