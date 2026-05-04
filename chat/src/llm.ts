/**
 * Claude streaming adapter. Wraps Anthropic SDK's streaming Messages API.
 *
 * Phase I.2 MVP: uses `dangerouslyAllowBrowser: true` for direct browser
 * calls during development. Phase J / production deployment should proxy
 * through Pulse Go server `/chat/stream` (TODO endpoint, post-launch) to
 * keep API keys off the client.
 *
 * Anti-MF0 rule: this file caps at ~150 lines. If we need more chat features
 * (tool use, vision, system prompt builder), they go in sibling files.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Message } from './state.js';
import type { RetrieveResponse } from './api.js';
import type { ContextPack } from './context/context-pack.js';
import type { ConversationRoute } from './router/domain-router.js';
import { buildSystemPrompt } from './prompt/prompt-builder.js';
import { getIdentity, type HearthIdentity } from './identity.js';
import elleNormalRu from './prompts/elle_normal_ru.md';

export interface LLMConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  baseSystem?: string;
}

export interface StreamArgs {
  messages: Message[];
  route?: ConversationRoute;
  contextPacks?: ContextPack[];
  retrieved?: RetrieveResponse;
  retrievedTexts?: Map<number, string>;
  /** When set, replaces the default system prompt entirely. Used for cartographer onboarding. */
  overrideSystem?: string;
  onChunk: (text: string) => void;
  onComplete: () => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
}

const GENERIC_HEARTH_SYSTEM = `You are Hearth, a single companion voice with access to the user's memory via Pulse.

Use any retrieved memories provided in <retrieved_memory> or <context_pack> blocks to ground your replies — but speak naturally; don't quote event_ids, classifiers, or scope to the user.

If retrieval is empty or low-confidence, respond from general knowledge and let the user know you don't have specific memory of what they're asking about.`;

/**
 * Choose the default system prompt based on the runtime identity.
 *
 * `elle` — Nik's personal Elle voice (Russian, female, harness for Hearth chat).
 * `default` — generic multi-person Hearth companion (no personal context baked in).
 *
 * Identity is read per turn from `localStorage["hearth:identity"]` via
 * `getIdentity()` so Nik can flip voices in DevTools without a rebuild.
 */
export function chooseDefaultSystem(identity: HearthIdentity): string {
  if (identity === 'elle') return elleNormalRu;
  return GENERIC_HEARTH_SYSTEM;
}

function defaultSystem(): string {
  return chooseDefaultSystem(getIdentity());
}

export class ClaudeAdapter {
  private client: Anthropic;
  private cfg: LLMConfig;

  constructor(cfg: LLMConfig) {
    this.cfg = cfg;
    this.client = new Anthropic({
      apiKey: cfg.apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  async stream(args: StreamArgs): Promise<void> {
    try {
      const system = args.overrideSystem
        ? args.overrideSystem
        : this.buildSystem(args);
      const apiMessages = args.messages
        .filter((m) => m.role !== 'system' && m.text.trim())
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.text,
        }));

      const stream = await this.client.messages.stream({
        model: this.cfg.model ?? 'claude-sonnet-4-6',
        max_tokens: this.cfg.maxTokens ?? 2048,
        system,
        messages: apiMessages,
      });

      stream.on('text', (text) => args.onChunk(text));
      stream.on('error', (err) => args.onError(err as Error));
      await stream.finalMessage();
      args.onComplete();
    } catch (err) {
      args.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private buildSystem(args: StreamArgs): string {
    if (args.contextPacks || args.route) {
      return buildSystemPrompt({
        baseSystem: this.cfg.baseSystem ?? defaultSystem(),
        route: args.route,
        contextPacks: args.contextPacks,
      });
    }

    const parts: string[] = [this.cfg.baseSystem ?? defaultSystem()];

    if (args.retrieved && args.retrieved.event_ids.length > 0) {
      const lines = args.retrieved.event_ids.map((id) => {
        const text = args.retrievedTexts?.get(id);
        return text
          ? `[event_id=${id}] ${text}`
          : `[event_id=${id}] (text not loaded; reference by id only)`;
      });
      parts.push(
        '',
        '<retrieved_memory>',
        ...lines,
        '</retrieved_memory>',
        '',
        `Mode used: ${args.retrieved.mode_used} (router: ${args.retrieved.classifier}, confidence ${args.retrieved.confidence.toFixed(2)})`,
      );
    } else if (args.retrieved) {
      parts.push(
        '',
        '<retrieved_memory>(no memories matched)</retrieved_memory>',
      );
    }

    return parts.join('\n');
  }
}

export function makeAdapter(): ClaudeAdapter | null {
  const apiKey =
    localStorage.getItem('anthropic:key') ??
    (window as unknown as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  // Optional system prompt override from Settings panel.
  // When unset, ClaudeAdapter falls back to chooseDefaultSystem(getIdentity()).
  const override = (() => {
    try {
      const v = localStorage.getItem('hearth:system_override');
      return v && v.trim() ? v : undefined;
    } catch {
      return undefined;
    }
  })();
  return new ClaudeAdapter({ apiKey, baseSystem: override });
}
