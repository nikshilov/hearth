/**
 * Demo mode wiring — `?demo=1` swaps the real Pulse client and the
 * Anthropic adapter for offline, deterministic mocks.
 *
 * Goals:
 *   1. No network — no Pulse, no Anthropic, no embeddings, nothing.
 *   2. No persistence — every reload starts clean.
 *   3. Realistic UX — fixture retrieval has 200-400ms latency, replies
 *      stream chunk-by-chunk so the cursor blinks like the real adapter.
 *
 * Never imported when ?demo=1 is absent — main.ts gates the import.
 */
import { PulseClient, type ContextQueryRequest, type IngestObservation, type RetrieveRequest, type RetrieveResponse } from './api.js';
import type { PulseContextResult } from './context/pulse-context-result.js';
import type { ClaudeAdapter, StreamArgs } from './llm.js';
import { DEMO_EVENTS, DEMO_FALLBACK, DEMO_TURNS } from './demo-fixtures.js';

export function isDemoMode(): boolean {
  return new URLSearchParams(location.search).has('demo');
}

/**
 * Wipe persistence so the demo always starts clean, AND seal localStorage
 * so subsequent `setItem` calls for hearth-namespaced keys are no-ops.
 *
 * Called from main.ts when ?demo=1 is set, before cartographer or any
 * other module loads. Without the seal, cartographer.bumpTurn() and
 * applyExtraction() would write through and persist demo state across
 * reloads — breaking the "every reload is fresh" rule.
 */
const SEALED_KEY_PREFIXES = ['hearth:', 'anthropic:', 'pulse:'];
export function purgeLocalStorageForDemo(): void {
  try {
    for (const prefix of SEALED_KEY_PREFIXES) {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => localStorage.removeItem(k));
    }
    // Seal: silently swallow writes to hearth-owned keys.
    const realSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (this === localStorage && SEALED_KEY_PREFIXES.some((p) => key.startsWith(p))) {
        return; // demo never persists
      }
      return realSet.call(this, key, value);
    };
  } catch {
    // private mode / SSR / blocked — nothing to do, demo will still work.
  }
}

/**
 * Mock Pulse client — extends the real PulseClient so it is
 * a structural drop-in. Never makes a network request; returns top-3
 * salient fixture events from `DEMO_EVENTS`.
 */
export class MockPulseClient extends PulseClient {
  constructor() {
    super({ baseUrl: 'demo://offline', apiKey: '' });
  }

  override async recall(req: RetrieveRequest): Promise<RetrieveResponse> {
    await sleep(200 + Math.random() * 200);
    const turnIndex = getTurnIndex();
    const turn = DEMO_TURNS[turnIndex] ?? DEMO_FALLBACK;
    const ids = turn.retrievedIds.length
      ? turn.retrievedIds
      : DEMO_EVENTS.slice()
          .sort((a, b) => b.salience - a.salience)
          .slice(0, 3)
          .map((e) => e.id);
    return {
      event_ids: ids,
      mode_used: 'empathic',
      confidence: 0.78,
      classifier: 'demo-fixture',
      reasoning: `query: ${req.query.slice(0, 40)}…`,
    };
  }


  override async contextQuery(req: ContextQueryRequest): Promise<PulseContextResult> {
    await sleep(200 + Math.random() * 200);
    const turnIndex = getTurnIndex();
    const turn = DEMO_TURNS[turnIndex] ?? DEMO_FALLBACK;
    const ids = turn.retrievedIds.length
      ? turn.retrievedIds
      : DEMO_EVENTS.slice(0, 3).map((e) => e.id);
    const events = DEMO_EVENTS.filter((e) => ids.includes(e.id));
    return {
      schema_version: 'pulse.context.v1',
      query: req.query,
      mode_used: 'empathic',
      scope: req.scope ?? 'nik',
      facts: events.map((e) => ({ id: e.id, text: e.text, provenance: 'demo-fixture' })),
      emotional_anchors: events
        .filter((e) => e.anchor)
        .map((e) => ({ event_id: e.id, summary: e.text })),
      events: [],
      entities: [],
      relations: [],
      forbidden: [],
      private: [],
      uncertainty: [],
      importance_questions: [],
    };
  }

  override async ingest(_obs: IngestObservation[]): Promise<{ ok: boolean }> {
    await sleep(80);
    return { ok: true };
  }
}

/**
 * Mock Claude adapter — replays canned replies from `DEMO_TURNS` chunk by
 * chunk to mimic SSE streaming. Walks scenarios in order; falls through to
 * `DEMO_FALLBACK` once exhausted.
 *
 * Implements the same .stream() shape as `ClaudeAdapter` so the orchestrator
 * does not branch on demo mode.
 */
export class MockClaudeAdapter implements Pick<ClaudeAdapter, 'stream'> {
  async stream(args: StreamArgs): Promise<void> {
    try {
      const turnIndex = consumeTurnIndex();
      const turn = DEMO_TURNS[turnIndex] ?? DEMO_FALLBACK;
      const text = turn.assistant;
      // Initial think-pause (matches the real LLM TTFT), then stream.
      await sleep(350);
      for (const chunk of chunkText(text)) {
        if (args.signal?.aborted) {
          args.onError(new Error('aborted'));
          return;
        }
        args.onChunk(chunk);
        await sleep(35 + Math.random() * 50);
      }
      args.onComplete();
    } catch (e) {
      args.onError(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

// ── scenario walk-state ─────────────────────────────────────────────
// Module-scoped; resets on full reload (which is also when localStorage
// gets purged), so behavior matches the "every reload is fresh" rule.
let nextTurnIndex = 0;
function getTurnIndex(): number {
  return Math.min(nextTurnIndex, DEMO_TURNS.length);
}
function consumeTurnIndex(): number {
  const i = nextTurnIndex;
  nextTurnIndex = Math.min(nextTurnIndex + 1, DEMO_TURNS.length);
  return i;
}

// ── helpers ─────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Split text into stream-shaped chunks. Roughly word + occasional
 * 2-3 word groups, with whitespace preserved. Matches what real Anthropic
 * SSE looks like in the textarea.
 */
function chunkText(text: string): string[] {
  const out: string[] = [];
  const tokens = text.split(/(\s+)/);
  let buf = '';
  for (const t of tokens) {
    buf += t;
    if (buf.length >= 4 && /\s$/.test(buf)) {
      out.push(buf);
      buf = '';
    }
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * Mount a small "demo" badge in the corner so viewers of the GIF understand
 * the session is canned. Subscript on the existing ember mark.
 */
export function mountDemoBadge(): void {
  document.body.classList.add('demo-mode');
  const corner = document.querySelector('.hearth-corner');
  if (!corner) return;
  if (corner.querySelector('.demo-badge')) return;
  const badge = document.createElement('span');
  badge.className = 'demo-badge';
  badge.textContent = 'demo';
  corner.appendChild(badge);
}
