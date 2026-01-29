# OpenCode Proxy

[![npm version](https://img.shields.io/npm/v/opencode-proxy.svg)](https://www.npmjs.com/package/opencode-proxy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Per-provider proxy configuration for OpenCode.

```json
{
  "google": "http://127.0.0.1:20171",
  "openai": "socks5://127.0.0.1:1080"
}
```

Unconfigured providers connect directly — no `direct` array needed.

---

## Install

```bash
npm install opencode-proxy
```

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-proxy"]
}
```

Create `~/.config/opencode/proxy.json`:

```json
{
  "google": "http://127.0.0.1:20171"
}
```

Done. Kimi, Moonshot, and other providers connect directly.

---

## Config

**File:** `~/.config/opencode/proxy.json`

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
| `debug` | `boolean` | Enable debug logging |
| `<provider>` | `string` | Proxy URL: `protocol://[user:pass@]host:port` |

### Supported Protocols

- `http://host:port`
- `https://host:port`
- `socks5://host:port`
- `socks4://host:port`

### Providers

`google`, `anthropic`, `openai`, `azure`, `amazon-bedrock`, `moonshot`, `kimi`, `deepseek`, `groq`, `mistral`, `cohere`, `together`, `perplexity`, `openrouter`, `github-copilot`, `xai`, `cerebras`, `fireworks`

---

## Examples

**Single provider:**
```json
{
  "google": "http://127.0.0.1:20171"
}
```

**With auth:**
```json
{
  "google": "http://user:pass@proxy.com:8080"
}
```

**Debug mode:**
```json
{
  "debug": true,
  "google": "http://127.0.0.1:20171"
}
```

---

## How It Works

The plugin patches `fetch` to route configured providers through their specified proxy. Unconfigured providers connect directly.

---

## License

MIT
