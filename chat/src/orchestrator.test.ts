// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { PulseClient } from './api.js';
import { cartographer } from './cartographer.js';
import type { LLMStreamer } from './orchestrator.js';
import { onComposerSendForTest, runNormalTurnForTest } from './orchestrator.js';
import { AppState } from './state.js';

describe('runNormalTurnForTest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('falls back to a normal assistant response when Pulse recall fails', async () => {
    const state = new AppState();
    const pulse = {
      ingest: vi.fn().mockResolvedValue({ ok: true }),
      recall: vi.fn().mockRejectedValue(new Error('Pulse down')),
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
    expect(state.messages.some((m) => m.text.includes('recall error'))).toBe(false);
    expect(llm.stream).toHaveBeenCalledOnce();
  });

  test('does not show ingest errors in the user-facing chat', async () => {
    const state = new AppState();
    const pulse = {
      ingest: vi.fn().mockRejectedValue(new Error('DB locked')),
      recall: vi.fn().mockResolvedValue({
        event_ids: [],
        mode_used: 'empathic',
        confidence: 0.8,
        classifier: 'test',
      }),
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
      recall: vi.fn().mockResolvedValue({
        event_ids: [1],
        mode_used: 'factual',
        confidence: 0.8,
        classifier: 'test',
      }),
    } as unknown as PulseClient;

    await runNormalTurnForTest('привет', { pulse, llm: null, state });

    const visible = state.messages.map((m) => m.text).join('\n');
    expect(visible).not.toContain('route=');
    expect(visible).not.toContain('retrieval:');
    expect(visible).not.toContain('events=');
    expect(visible).toContain('Anthropic key');
  });

  test('switches from onboarding to normal silently without naming Cartographer as agent', async () => {
    const state = new AppState();
    const pulse = {
      ingest: vi.fn().mockResolvedValue({ ok: true }),
      recall: vi.fn().mockResolvedValue({
        event_ids: [],
        mode_used: 'empathic',
        confidence: 0.8,
        classifier: 'test',
      }),
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
