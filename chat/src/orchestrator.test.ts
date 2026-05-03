// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { PulseClient } from './api.js';
import { cartographer } from './cartographer.js';
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

describe('runNormalTurnForTest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('falls back to a normal assistant response when Pulse context query fails', async () => {
    const state = new AppState();
    const pulse = {
      ingest: vi.fn().mockResolvedValue({ ok: true }),
      recall: vi.fn().mockRejectedValue(new Error('recall should not be called')),
      contextQuery: vi.fn().mockRejectedValue(new Error('Pulse down')),
    } as unknown as PulseClient;
    const llm: LLMStreamer = {
      stream: vi.fn(async (args) => {
        args.onChunk('Я рядом без памяти.');
        args.onComplete();
      }),
    };

    await runNormalTurnForTest('мне холодно внутри', { pulse, llm, state });

    expect(state.messages.map((m) => [m.role, m.text])).toEqual([
      ['user', 'мне холодно внутри'],
      ['assistant', 'Я рядом без памяти.'],
    ]);
    expect(state.messages.some((m) => m.text.includes('context query'))).toBe(false);
    expect((pulse as unknown as { recall: ReturnType<typeof vi.fn> }).recall).not.toHaveBeenCalled();
    expect(llm.stream).toHaveBeenCalledOnce();
  });

  test('does not show ingest errors in the user-facing chat', async () => {
    const state = new AppState();
    const pulse = {
      ingest: vi.fn().mockRejectedValue(new Error('DB locked')),
      recall: vi.fn().mockRejectedValue(new Error('recall should not be called')),
      contextQuery: vi.fn().mockResolvedValue(makePulseContext()),
    } as unknown as PulseClient;
    const llm: LLMStreamer = {
      stream: vi.fn(async (args) => {
        args.onChunk('Я отвечаю без внутренней ошибки.');
        args.onComplete();
      }),
    };

    await runNormalTurnForTest('привет', { pulse, llm, state });
    await Promise.resolve();

    expect(state.messages.map((m) => m.text).join('\n')).not.toContain('ingest error');
  });

  test('no-key fallback does not expose route or retrieval internals', async () => {
    const state = new AppState();
    const pulse = {
      ingest: vi.fn().mockResolvedValue({ ok: true }),
      recall: vi.fn().mockRejectedValue(new Error('recall should not be called')),
      contextQuery: vi.fn().mockResolvedValue(makePulseContext()),
    } as unknown as PulseClient;

    await runNormalTurnForTest('привет', { pulse, llm: null, state });

    const visible = state.messages.map((m) => m.text).join('\n');
    expect(visible).not.toContain('route=');
    expect(visible).not.toContain('retrieval:');
    expect(visible).not.toContain('events=');
    expect(visible).toContain('Anthropic key');
  });


  test('uses Pulse contextQuery instead of raw recall in normal mode', async () => {
    const state = new AppState();
    const pulse = {
      ingest: vi.fn().mockResolvedValue({ ok: true }),
      recall: vi.fn().mockRejectedValue(new Error('recall should not be called')),
      contextQuery: vi.fn().mockResolvedValue(makePulseContext({
        facts: [{ id: 1, text: 'context fact' }],
      })),
    } as unknown as PulseClient;
    const llm: LLMStreamer = {
      stream: vi.fn(async (args) => {
        expect(args.contextPacks?.some((p: { name: string }) => p.name === 'pulse_facts')).toBe(true);
        args.onChunk('answer');
        args.onComplete();
      }),
    };

    await runNormalTurnForTest('мне холодно внутри', { pulse, llm, state });

    expect((pulse as unknown as { contextQuery: ReturnType<typeof vi.fn> }).contextQuery).toHaveBeenCalledOnce();
    expect((pulse as unknown as { recall: ReturnType<typeof vi.fn> }).recall).not.toHaveBeenCalled();
  });

  test('falls back without visible internals when contextQuery fails', async () => {
    const state = new AppState();
    const pulse = {
      ingest: vi.fn().mockResolvedValue({ ok: true }),
      recall: vi.fn(),
      contextQuery: vi.fn().mockRejectedValue(new Error('Pulse down')),
    } as unknown as PulseClient;
    const llm: LLMStreamer = {
      stream: vi.fn(async (args) => {
        expect(args.contextPacks?.some((p: { name: string }) => p.name.startsWith('pulse_'))).toBe(false);
        args.onChunk('Я рядом.');
        args.onComplete();
      }),
    };

    await runNormalTurnForTest('тяжело', { pulse, llm, state });

    const visible = state.messages.map((m) => m.text).join('\n');
    expect(visible).not.toContain('context query');
    expect(visible).not.toContain('Pulse down');
    expect(visible).toContain('Я рядом.');
  });

  test('switches from onboarding to normal silently without naming Cartographer as agent', async () => {
    const state = new AppState();
    const pulse = {
      ingest: vi.fn().mockResolvedValue({ ok: true }),
      recall: vi.fn().mockRejectedValue(new Error('recall should not be called')),
      contextQuery: vi.fn().mockResolvedValue(makePulseContext()),
    } as unknown as PulseClient;
    const llm: LLMStreamer = {
      stream: vi.fn(async (args) => {
        args.onChunk('тихий ответ');
        args.onComplete();
      }),
    };

    cartographer.reset();
    cartographer.state.turns_count = 24;
    cartographer.forceMode('onboarding');

    await onComposerSendForTest('последний onboarding turn', { pulse, llm, state });

    expect(cartographer.state.mode).toBe('normal');
    expect(state.messages.some((m) => /картограф|обычный разговор/i.test(m.text))).toBe(false);
  });
});
