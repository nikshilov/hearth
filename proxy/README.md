# hearth chat-proxy

Tiny HTTP bridge from the Hearth browser to the local `claude` CLI, so Hearth chat turns go through your **Max subscription** instead of the Anthropic API.

## Why

Hearth's browser-side `ClaudeAdapter` calls Anthropic with an API key. That bills the API account directly. If you already pay for Claude Max, you'd rather not double-pay.

This proxy:

- listens on `127.0.0.1:18791`
- accepts `POST /chat` from Hearth (`http://localhost:5173`)
- spawns `claude -p --no-session-persistence --output-format json --tools "" --system-prompt ... --model ... <prompt>` from a clean cwd
- returns the parsed result

The `claude` CLI must already be logged into Max (`claude /login` once).

## Run

```bash
cd ~/dev/ai/Garden/hearth/proxy
node chat-proxy.mjs
# or auto-restart on edit:
node --watch chat-proxy.mjs
```

Override defaults via env:

```
HEARTH_PROXY_PORT=18791
HEARTH_PROXY_HOST=127.0.0.1
HEARTH_PROXY_CWD=/tmp/hearth-claude-cwd
HEARTH_CLAUDE_BIN=claude
```

## API

### `POST /chat`

```json
{
  "system": "Я Элли...",
  "messages": [
    { "role": "user", "text": "first" },
    { "role": "assistant", "text": "ok" },
    { "role": "user", "text": "second" }
  ],
  "model": "sonnet"
}
```

### `200 OK`

```json
{
  "content": "...",
  "model_used": "claude-sonnet-4-6",
  "session_id": "...",
  "duration_ms": 3120,
  "usage": { "input_tokens": 3, "output_tokens": 14, "cache_creation_input_tokens": 35689, "cache_read_input_tokens": 0 }
}
```

### Errors

- `400` — bad request body / empty messages
- `500` — `claude` exited non-zero or response JSON unparseable
- `502` — `claude` returned `is_error:true` (auth, rate limit, etc.)

## Trade-offs

- **No streaming yet** — returns the full message at once. Hearth `LocalClaudeAdapter` emits one `onChunk` to keep the UI shape compatible.
- **Multi-turn via Markdown transcript** — the messages array is rendered as `**User:** ... **Assistant:** ...` and passed as one `--print` prompt. For Phase 2 we can switch to `--input-format stream-json` and full message threading.
- **Cache cost on first call** — Claude Code prepends ~35K tokens of base system context even with `--exclude-dynamic-system-prompt-sections` and `--tools ""`. After the first call it goes to cache_read for the next hour. This is on Max metering, not API billing.

## Stop

```bash
kill $(lsof -tiTCP:18791 -sTCP:LISTEN)
```
