#!/usr/bin/env node
/**
 * hearth chat-proxy
 *
 * Tiny local HTTP bridge from the Hearth browser to the `claude` CLI.
 * Runs `claude -p` headless against the Max subscription so chat turns
 * do NOT bill against an Anthropic API key.
 *
 *   POST /chat
 *     body: { system?: string, messages: Array<{role,text|content}>, model? }
 *     200:  { content: string, model_used, usage, session_id, duration_ms }
 *     500:  { error, stderr? }
 *
 *   GET  /health
 *     200:  { status:'ok', version }
 *
 * Defaults:
 *   - listen 127.0.0.1:18791
 *   - cwd: /tmp/hearth-claude-cwd (kept clean of CLAUDE.md to keep the
 *     auto-loaded system context small; cache_creation drops from ~60K
 *     tokens to ~35K)
 *   - tools "" (no tool use; this is chat, not coding)
 *   - --no-session-persistence (no transcripts written)
 *   - model: sonnet (override per-request)
 *
 * CORS allows http://localhost:5173 / http://127.0.0.1:5173 (Hearth dev).
 *
 * Auth: `claude` CLI must already be logged in (Max OAuth via `claude /login`).
 * This file does NOT touch keys.
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const PORT = Number(process.env.HEARTH_PROXY_PORT ?? 18791);
const HOST = process.env.HEARTH_PROXY_HOST ?? '127.0.0.1';
const CWD = process.env.HEARTH_PROXY_CWD ?? '/tmp/hearth-claude-cwd';
const CLAUDE_BIN = process.env.HEARTH_CLAUDE_BIN ?? 'claude';
const VERSION = '0.1.0';
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const REQUEST_TIMEOUT_MS = 120_000;

mkdirSync(CWD, { recursive: true });

const server = http.createServer(async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { status: 'ok', version: VERSION });
  }

  if (req.method === 'POST' && req.url === '/chat') {
    return handleChat(req, res);
  }

  return json(res, 404, { error: 'not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[hearth chat-proxy v${VERSION}] http://${HOST}:${PORT} (cwd=${CWD})`);
});

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJson(req, max = 1_000_000) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (c) => {
      total += c.length;
      if (total > max) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function handleChat(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return json(res, 400, { error: `bad request: ${e.message}` });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const system = typeof body.system === 'string' ? body.system : '';
  const model = typeof body.model === 'string' && body.model ? body.model : 'sonnet';
  if (messages.length === 0) {
    return json(res, 400, { error: 'messages is required (non-empty array)' });
  }

  const prompt = messagesToPrompt(messages);
  const args = [
    '-p',
    '--no-session-persistence',
    '--output-format', 'json',
    '--tools', '',
    '--model', model,
    '--exclude-dynamic-system-prompt-sections',
  ];
  if (system) args.push('--system-prompt', system);
  args.push(prompt);

  const started = Date.now();
  const child = spawn(CLAUDE_BIN, args, {
    cwd: CWD,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  let out = '';
  let err = '';
  child.stdout.on('data', (c) => { out += c; });
  child.stderr.on('data', (c) => { err += c; });

  const timeout = setTimeout(() => {
    child.kill('SIGKILL');
  }, REQUEST_TIMEOUT_MS);

  child.on('close', (code) => {
    clearTimeout(timeout);
    if (code !== 0) {
      return json(res, 500, {
        error: `claude exited with code ${code}`,
        stderr: err.slice(0, 4000),
      });
    }
    let parsed;
    try {
      parsed = JSON.parse(out);
    } catch (e) {
      return json(res, 500, {
        error: `cannot parse claude json: ${e.message}`,
        raw: out.slice(0, 4000),
      });
    }
    if (parsed.is_error) {
      return json(res, 502, {
        error: parsed.result || 'claude reported error',
        api_error_status: parsed.api_error_status ?? null,
      });
    }
    return json(res, 200, {
      content: parsed.result ?? '',
      model_used: parsed.modelUsage ? Object.keys(parsed.modelUsage)[0] : model,
      session_id: parsed.session_id ?? null,
      duration_ms: Date.now() - started,
      usage: parsed.usage ?? null,
    });
  });

  child.on('error', (e) => {
    clearTimeout(timeout);
    json(res, 500, { error: `spawn failed: ${e.message}` });
  });
}

/**
 * Render Hearth message history as a single Markdown transcript that ends
 * on a User turn. claude --print picks up the last User: line and answers
 * as Assistant. Single-message case is passed verbatim.
 */
function messagesToPrompt(messages) {
  const cleaned = messages
    .map((m) => ({ role: m.role, text: (m.text ?? m.content ?? '').toString().trim() }))
    .filter((m) => m.text);
  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return cleaned[0].text;
  return cleaned
    .map((m) => `**${m.role === 'assistant' ? 'Assistant' : 'User'}:** ${m.text}`)
    .join('\n\n');
}

// graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`[hearth chat-proxy] ${sig}, closing`);
    server.close(() => process.exit(0));
  });
}
