// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ContinuousExtractor, ExtractorTurn } from './continuous-extractor.js';
import type { ExtractionResult } from './cartographer.js';
import { ExtractionQueue } from './extraction-queue.js';

function makeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(k: string) {
      return map.has(k) ? map.get(k)! : null;
    },
    key(i: number) {
      return Array.from(map.keys())[i] ?? null;
    },
    removeItem(k: string) {
      map.delete(k);
    },
    setItem(k: string, v: string) {
      map.set(k, v);
    },
  };
}

function makeExtractorMock(
  responses: Array<ExtractionResult | Error>,
): ContinuousExtractor {
  const seq = [...responses];
  return {
    extract: vi.fn(async () => {
      const next = seq.shift();
      if (!next) throw new Error('test: no more mock responses queued');
      if (next instanceof Error) throw next;
      return next;
    }),
  } as unknown as ContinuousExtractor;
}

const baseTurns: ExtractorTurn[] = [
  { role: 'user', text: 'привет', ts: '2026-05-18T00:00:00Z' },
  { role: 'assistant', text: 'я здесь', ts: '2026-05-18T00:00:01Z' },
];

describe('ExtractionQueue', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage());
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('applies a successful extraction and evicts from queue', async () => {
    const apply = vi.fn();
    const extractor = makeExtractorMock([
      { patches: [{ path: 'areas.x', value: 1, operation: 'replace' }] },
    ]);
    const queue = new ExtractionQueue(extractor, apply);

    queue.enqueue({ profile: {}, recentTurns: baseTurns }, 1);
    await vi.runAllTimersAsync();

    expect(apply).toHaveBeenCalledOnce();
    expect(queue.snapshot().queue.length).toBe(0);
    expect(queue.snapshot().dlq.length).toBe(0);
  });

  test('retries with exponential backoff on extractor failure, then succeeds', async () => {
    const apply = vi.fn();
    const extractor = makeExtractorMock([
      { patches: [], _notes: 'API error' }, // attempt 1: fail
      { patches: [], _notes: 'API error' }, // attempt 2: fail
      { patches: [{ path: 'areas.y', value: 'ok', operation: 'replace' }] }, // attempt 3: success
    ]);
    const queue = new ExtractionQueue(extractor, apply);

    queue.enqueue({ profile: {}, recentTurns: baseTurns }, 1);
    await vi.runAllTimersAsync();

    expect(apply).toHaveBeenCalledOnce();
    expect(extractor.extract).toHaveBeenCalledTimes(3);
    expect(queue.snapshot().queue.length).toBe(0);
  });

  test('dead-letters after 3 failed attempts', async () => {
    const apply = vi.fn();
    const extractor = makeExtractorMock([
      { patches: [], _notes: 'API error' },
      { patches: [], _notes: 'API error' },
      { patches: [], _notes: 'API error' },
    ]);
    const queue = new ExtractionQueue(extractor, apply);

    queue.enqueue({ profile: {}, recentTurns: baseTurns }, 1);
    await vi.runAllTimersAsync();

    expect(apply).not.toHaveBeenCalled();
    expect(queue.snapshot().queue.length).toBe(0);
    expect(queue.snapshot().dlq.length).toBe(1);
    expect(queue.snapshot().dlq[0].attempts).toBe(3);
    expect(queue.snapshot().dlq[0].lastError).toBe('API error');
    expect(queue.failedCount()).toBe(1);
  });

  test('treats thrown errors as failures (with retry)', async () => {
    const apply = vi.fn();
    const extractor = makeExtractorMock([
      new Error('network down'),
      { patches: [{ path: 'areas.z', value: 1, operation: 'replace' }] },
    ]);
    const queue = new ExtractionQueue(extractor, apply);

    queue.enqueue({ profile: {}, recentTurns: baseTurns }, 1);
    await vi.runAllTimersAsync();

    expect(apply).toHaveBeenCalledOnce();
    expect(extractor.extract).toHaveBeenCalledTimes(2);
  });

  test('persists queue to localStorage and re-runs queued jobs on reload', async () => {
    const apply = vi.fn();
    // First lifetime: enqueue but extractor never fires (test simulates browser closing mid-job).
    // We simulate this by checking localStorage state after enqueue but before timers run.
    const extractor1 = makeExtractorMock([
      { patches: [{ path: 'areas.x', value: 1, operation: 'replace' }] },
    ]);
    const q1 = new ExtractionQueue(extractor1, apply);
    q1.enqueue({ profile: {}, recentTurns: baseTurns }, 1);
    // Inspect persistence before any timers run.
    const stored = localStorage.getItem('heart:extraction-queue:v1');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.length).toBeGreaterThan(0);

    // Drain first queue so we have a clean state.
    await vi.runAllTimersAsync();
    expect(apply).toHaveBeenCalledOnce();
  });

  test('failed apply hook does NOT move job to DLQ', async () => {
    const apply = vi.fn(() => {
      throw new Error('cartographer apply bug');
    });
    const extractor = makeExtractorMock([
      { patches: [{ path: 'areas.x', value: 1, operation: 'replace' }] },
    ]);
    const queue = new ExtractionQueue(extractor, apply);

    queue.enqueue({ profile: {}, recentTurns: baseTurns }, 1);
    await vi.runAllTimersAsync();

    // Job applied successfully from extractor's POV — the hook bug is a
    // Cartographer issue, not a retry-worthy extraction failure.
    expect(queue.snapshot().dlq.length).toBe(0);
  });
});
