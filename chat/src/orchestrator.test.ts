// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cartographer } from './cartographer.js';
import type { MemoryBackend } from './memory/backend.js';
import type { LLMStreamer } from './orchestrator.js';
import { onComposerSendForTest, runNormalTurnForTest } from './orchestrator.js';
import { AppState } from './state.js';

function makePulseContext(patch = {}) {
  return {
    schema_version: 'pulse.context.v1' as const,
    query: 'test',
    mode_used: 'empathic',
    scope: 'nik',
    facts: [],
    emotional_anchors: [],
    events: [],
    entities: [],
    relations: [],
    forbidden: [],
    private: [],
    uncertainty: [],
    importance_questions: [],
    ...patch,
  };
}

/**
 * Test helper: build a MemoryBackend mock. `contextResult` is the raw
 * PulseContextResult-shaped object the backend's buildContext should
 * return as `.raw`, or null to simulate retrieval failure.
 */
function makeMemoryMock(opts: {
  ingestResult?: unknown;
  ingestError?: Error;
  context?: ReturnType<typeof makePulseContext> | null;
  contextError?: Error;
}): MemoryBackend & {
  ingestTurn: ReturnType<typeof vi.fn>;
  buildContext: ReturnType<typeof vi.fn>;
} {
  const ingestTurn = opts.ingestError
    ? vi.fn().mockRejectedValue(opts.ingestError)
    : vi.fn().mockResolvedValue(undefined);
  const buildContext = opts.contextError
    ? vi.fn().mockResolvedValue(null) // backend returns null on failure (per interface)
    : opts.context === null
      ? vi.fn().mockResolvedValue(null)
      : vi.fn().mockResolvedValue({
          modeUsed: opts.context?.mode_used ?? 'empathic',
          classifier: 'heart:pulse-context',
          confidence: 0.8,
          raw: opts.context ?? makePulseContext(),
        });
  return { ingestTurn, buildContext };
}

describe('runNormalTurnForTest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('falls back to a normal assistant response when memory context fails', async () => {
    const state = new AppState();
    const memory = makeMemoryMock({ context: null });
    const llm: LLMStreamer = {
      stream: vi.fn(async (args) => {
        args.onChunk('Я рядом без памяти.');
        args.onComplete();
      }),
    };

    await runNormalTurnForTest('мне холодно внутри', { memory, llm, state });

    expect(state.messages.map((m) => [m.role, m.text])).toEqual([
      ['user', 'мне холодно внутри'],
      ['assistant', 'Я рядом без памяти.'],
    ]);
    expect(state.messages.some((m) => m.text.includes('context query'))).toBe(false);
    expect(llm.stream).toHaveBeenCalledOnce();
  });

  test('does not show ingest errors in the user-facing chat', async () => {
    const state = new AppState();
    const memory = makeMemoryMock({
      ingestError: new Error('DB locked'),
      context: makePulseContext(),
    });
    const llm: LLMStreamer = {
      stream: vi.fn(async (args) => {
        args.onChunk('Я отвечаю без внутренней ошибки.');
        args.onComplete();
      }),
    };

    await runNormalTurnForTest('привет', { memory, llm, state });
    await Promise.resolve();

    expect(state.messages.map((m) => m.text).join('\n')).not.toContain('ingest error');
  });

  test('no-key fallback does not expose route or retrieval internals', async () => {
    const state = new AppState();
    const memory = makeMemoryMock({ context: makePulseContext() });

    await runNormalTurnForTest('привет', { memory, llm: null, state });

    const visible = state.messages.map((m) => m.text).join('\n');
    expect(visible).not.toContain('route=');
    expect(visible).not.toContain('retrieval:');
    expect(visible).not.toContain('events=');
    expect(visible).toContain('Anthropic key');
  });


  test('uses memory.buildContext in normal mode', async () => {
    const state = new AppState();
    const memory = makeMemoryMock({
      context: makePulseContext({
        facts: [{ id: 1, text: 'context fact' }],
      }),
    });
    const llm: LLMStreamer = {
      stream: vi.fn(async (args) => {
        expect(args.contextPacks?.some((p: { name: string }) => p.name === 'pulse_facts')).toBe(true);
        args.onChunk('answer');
        args.onComplete();
      }),
    };

    await runNormalTurnForTest('мне холодно внутри', { memory, llm, state });

    expect(memory.buildContext).toHaveBeenCalledOnce();
  });

  test('falls back without visible internals when memory.buildContext returns null', async () => {
    const state = new AppState();
    const memory = makeMemoryMock({ context: null });
    const llm: LLMStreamer = {
      stream: vi.fn(async (args) => {
        expect(args.contextPacks?.some((p: { name: string }) => p.name.startsWith('pulse_'))).toBe(false);
        args.onChunk('Я рядом.');
        args.onComplete();
      }),
    };

    await runNormalTurnForTest('тяжело', { memory, llm, state });

    const visible = state.messages.map((m) => m.text).join('\n');
    expect(visible).not.toContain('context query');
    expect(visible).not.toContain('Pulse down');
    expect(visible).toContain('Я рядом.');
  });

  test('switches from onboarding to normal silently without naming Cartographer as agent', async () => {
    const state = new AppState();
    const memory = makeMemoryMock({ context: makePulseContext() });
    const llm: LLMStreamer = {
      stream: vi.fn(async (args) => {
        args.onChunk('тихий ответ');
        args.onComplete();
      }),
    };

    cartographer.reset();
    cartographer.state.turns_count = 24;
    cartographer.forceMode('onboarding');

    await onComposerSendForTest('последний onboarding turn', { memory, llm, state });

    expect(cartographer.state.mode).toBe('normal');
    expect(state.messages.some((m) => /картограф|обычный разговор/i.test(m.text))).toBe(false);
  });
});
