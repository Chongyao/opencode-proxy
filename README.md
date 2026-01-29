# OpenCode Proxy

[![npm version](https://img.shields.io/npm/v/opencode-proxy.svg)](https://www.npmjs.com/package/opencode-proxy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Route different AI providers through different proxies — with a one-line config.**

OpenCode uses global `HTTP_PROXY`/`HTTPS_PROXY` environment variables that apply to **all** providers. This plugin allows you to:

- Route **Google/Gemini** through a specific proxy (`http://127.0.0.1:20171`)
- Connect **directly** to Kimi, Moonshot, DeepSeek (no proxy needed)
- Use **different proxies** for different providers based on your network requirements
- Support **HTTP, HTTPS, SOCKS4, and SOCKS5** proxies

**The catch?** You don't need to list providers that should connect directly. Just configure the ones that need a proxy — everything else connects directly by default.

---

## What you get

- **One-line per provider** — `"google": "http://127.0.0.1:20171"` and you're done
- **Direct by default** — Unconfigured providers connect directly (no `direct` array needed)
- **URL-based config** — Standard proxy URL format with embedded auth support
- **Multiple protocols** — HTTP, HTTPS, SOCKS4, SOCKS5
- **Debug logging** — See exactly which requests go through which proxy
- **Hot reload** — Changes to `proxy.json` are picked up automatically

---

## Installation

### For Humans

**Option A: Let an LLM do it**

Paste this into any LLM agent (Claude Code, OpenCode, Cursor, etc.):

```
Install and configure opencode-proxy by following: https://raw.githubusercontent.com/yourusername/opencode-proxy/main/README.md
```

**Option B: Manual setup**

1. **Install the plugin:**

   ```bash
   npm install opencode-proxy
   ```

2. **Add to your OpenCode config** (`~/.config/opencode/opencode.json`):

   ```json
   {
     "plugin": ["opencode-proxy"]
   }
   ```

3. **Create proxy configuration** (`~/.config/opencode/proxy.json`):

   ```json
   {
     "google": "http://127.0.0.1:20171"
   }
   ```

4. **Done.** Kimi, Moonshot, and all other providers will connect directly.

---

## Configuration

### Config File Location

The plugin looks for configuration at:
- `$XDG_CONFIG_HOME/opencode/proxy.json`
- `~/.config/opencode/proxy.json` (default)

### Config Format

```json
{
  "debug": true,
  "google": "http://127.0.0.1:20171",
  "anthropic": "socks5://user:pass@127.0.0.1:1080",
  "openai": "https://proxy.example.com:8443"
}
```

| Key | Type | Description |
|-----|------|-------------|
| `debug` | `boolean` | Enable debug logging (optional) |
| `<provider>` | `string` | Proxy URL for the provider (optional) |

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

Any provider ID that OpenCode supports:

- `google` — Google Gemini API
- `anthropic` — Anthropic Claude API
- `openai` — OpenAI API
- `azure` — Azure OpenAI
- `amazon-bedrock` — AWS Bedrock
- `moonshot` / `kimi` — Moonshot AI (Kimi)
- `deepseek` — DeepSeek AI
- `groq` — Groq
- `mistral` — Mistral AI
- `cohere` — Cohere
- `together` — Together AI
- `perplexity` — Perplexity
- `openrouter` — OpenRouter
- `github-copilot` — GitHub Copilot
- `xai` — xAI (Grok)
- `cerebras` — Cerebras
- `fireworks` — Fireworks AI

---

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

---

## How It Works

The plugin patches the global `fetch` function to intercept outgoing requests to AI providers:

1. Identifies the provider from the request URL
2. If the provider is configured with a proxy URL → routes through that proxy
3. If the provider is **not** configured → connects directly (no proxy)

**Before (v1.x):**
```json
{
  "version": "1",
  "providers": [
    { "provider": "google", "protocol": "http", "host": "127.0.0.1", "port": 20171 }
  ],
  "direct": ["moonshot", "kimi", "anthropic"]
}
```

**After (v2.x):**
```json
{
  "google": "http://127.0.0.1:20171"
}
```

Unconfigured providers automatically connect directly. No need to maintain a `direct` list.

---

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

---

## Plugin Interactions

### Compatible Plugins

- `oh-my-opencode` — Fully compatible
- `opencode-antigravity-auth` — Fully compatible

### Plugin Loading Order

If you encounter issues, ensure `opencode-proxy` is loaded before other plugins that modify network behavior:

```json
{
  "plugin": [
    "opencode-proxy",
    "other-network-plugin"
  ]
}
```

---

## Migration Guide (v1.x → v2.x)

### What Changed

v2.0 introduces a **simplified configuration format** that removes boilerplate:

| Before (v1.x) | After (v2.x) |
|--------------|--------------|
| `providers` array with objects | Direct key-value mapping |
| `direct` array for bypass list | **Not needed** — unconfigured providers connect directly |
| `version` field | **Not needed** |
| Separate `protocol`, `host`, `port` | Single URL string |

### Migration Steps

**Old config:**
```json
{
  "version": "1",
  "debug": true,
  "providers": [
    { "provider": "google", "protocol": "http", "host": "127.0.0.1", "port": 20171 },
    { "provider": "anthropic", "protocol": "direct" }
  ],
  "direct": ["moonshot", "kimi"]
}
```

**New config:**
```json
{
  "debug": true,
  "google": "http://127.0.0.1:20171"
}
```

That's it. `anthropic`, `moonshot`, and `kimi` automatically connect directly.

---

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

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## License

MIT License — see [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Built for [OpenCode](https://opencode.ai)
- Inspired by the need for fine-grained proxy control in AI development workflows
