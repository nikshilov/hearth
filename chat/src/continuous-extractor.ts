/**
 * Continuous extractor — runs after each meaningful exchange.
 * Reads recent turns + current profile, emits JSON patches.
 *
 * Model: Claude Haiku 4.5 (cheap, fast, schema-friendly).
 * Temperature: 0 (deterministic).
 * The extractor never speaks to the user — it patches the profile silently.
 *
 * Anti-MF0 rule: this file caps at ~120 lines.
 */
import Anthropic from '@anthropic-ai/sdk';
import { CONTINUOUS_PROMPT } from './cartographer-prompts.js';
import type { ExtractionResult } from './cartographer.js';
import type { Message } from './state.js';

export interface ExtractorTurn {
  role: 'user' | 'assistant';
  text: string;
  ts: string;
  event_id?: number;
}

export class ContinuousExtractor {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  async extract(args: {
    profile: unknown;
    recentTurns: ExtractorTurn[];
    observationDate?: string; // YYYY-MM-DD
    retrievedEventIds?: number[];
  }): Promise<ExtractionResult> {
    const obsDate = args.observationDate ?? todayISO();
    const userBlock = [
      '<current_profile>',
      JSON.stringify(args.profile, null, 2),
      '</current_profile>',
      '',
      '<recent_turns>',
      args.recentTurns
        .map((t) => {
          const idTag = t.event_id !== undefined ? ` [event_id=${t.event_id}]` : '';
          return `[${t.ts}]${idTag} ${t.role}: ${t.text}`;
        })
        .join('\n\n'),
      '</recent_turns>',
      '',
      '<retrieved_memories>',
      args.retrievedEventIds && args.retrievedEventIds.length > 0
        ? args.retrievedEventIds.map((id) => `event_id=${id}`).join(', ')
        : '(none)',
      '</retrieved_memories>',
      '',
      `<observation_date>${obsDate}</observation_date>`,
      '',
      'Output ONLY the JSON object. No prose, no markdown fences.',
    ].join('\n');

    let raw: string;
    try {
      const resp = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        temperature: 0,
        system: CONTINUOUS_PROMPT,
        messages: [{ role: 'user', content: userBlock }],
      });
      const block = resp.content[0];
      if (!block || block.type !== 'text') {
        return emptyResult('extractor returned non-text content');
      }
      raw = block.text;
    } catch (e) {
      console.error('extractor: API call failed', e);
      return emptyResult('API error');
    }

    const cleaned = stripFences(raw).trim();
    if (!cleaned) return emptyResult('empty response');

    try {
      const parsed = JSON.parse(cleaned) as ExtractionResult;
      if (!Array.isArray(parsed.patches)) parsed.patches = [];
      return parsed;
    } catch (e) {
      console.warn('extractor: JSON.parse failed', cleaned.slice(0, 200), e);
      return emptyResult('parse error');
    }
  }
}

function emptyResult(note: string): ExtractionResult {
  return { patches: [], _notes: note };
}

function stripFences(s: string): string {
  // Tolerate ```json ... ``` even though the prompt forbids them.
  const fence = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/;
  const m = s.match(fence);
  return m ? m[1] : s;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function makeExtractor(): ContinuousExtractor | null {
  const apiKey =
    localStorage.getItem('anthropic:key') ??
    (window as unknown as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new ContinuousExtractor(apiKey);
}

export function turnsFromMessages(msgs: Message[], lastN = 4): ExtractorTurn[] {
  return msgs
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.text.trim())
    .slice(-lastN)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      text: m.text,
      ts: new Date(m.ts).toISOString(),
    }));
}
