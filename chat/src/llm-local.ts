/**
 * LocalClaudeAdapter — talks to hearth/proxy/chat-proxy.mjs over HTTP, which
 * spawns the local `claude` CLI under your Max subscription. No Anthropic
 * API key in the browser, no API billing.
 *
 * Implements the same `stream()` contract as ClaudeAdapter so the orchestrator
 * does not branch on backend.
 *
 * No streaming yet — chat-proxy returns the full message, and we emit one
 * onChunk to keep the UI shape compatible. Phase 2 can switch to
 * `--output-format stream-json`.
 */
import type { StreamArgs } from './llm.js';
import { chooseDefaultSystem } from './llm.js';
import type { LLMStreamer } from './orchestrator.js';
import { getIdentity } from './identity.js';
import { buildSystemPrompt } from './prompt/prompt-builder.js';

export interface LocalClaudeConfig {
  baseUrl?: string;
  baseSystem?: string;
  model?: string;
}

const DEFAULT_PROXY_URL = 'http://127.0.0.1:18791';

export class LocalClaudeAdapter implements LLMStreamer {
  constructor(private cfg: LocalClaudeConfig = {}) {}

  async stream(args: StreamArgs): Promise<void> {
    try {
      const system = args.overrideSystem ?? this.buildSystem(args);
      const messages = args.messages
        .filter((m) => m.role !== 'system' && m.text.trim())
        .map((m) => ({ role: m.role, text: m.text }));

      const baseUrl = (this.cfg.baseUrl ?? DEFAULT_PROXY_URL).replace(/\/$/, '');
      const resp = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system,
          messages,
          model: this.cfg.model ?? 'sonnet',
        }),
        signal: args.signal,
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`chat-proxy ${resp.status}: ${text.slice(0, 500)}`);
      }
      const data = (await resp.json()) as { content?: string };
      const content = data.content ?? '';
      if (content) args.onChunk(content);
      args.onComplete();
    } catch (err) {
      args.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private buildSystem(args: StreamArgs): string {
    const base = this.cfg.baseSystem ?? chooseDefaultSystem(getIdentity());
    if (args.contextPacks || args.route) {
      return buildSystemPrompt({
        baseSystem: base,
        route: args.route,
        contextPacks: args.contextPacks,
      });
    }
    return base;
  }
}

export function makeLocalAdapter(): LocalClaudeAdapter {
  let baseUrl: string | undefined;
  try {
    baseUrl = localStorage.getItem('hearth:proxy_url') ?? undefined;
  } catch {
    baseUrl = undefined;
  }
  let override: string | undefined;
  try {
    const v = localStorage.getItem('hearth:system_override');
    override = v && v.trim() ? v : undefined;
  } catch {
    override = undefined;
  }
  return new LocalClaudeAdapter({ baseUrl, baseSystem: override });
}
