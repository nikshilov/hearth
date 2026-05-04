// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { LocalClaudeAdapter } from './llm-local.js';
import type { StreamArgs } from './llm.js';

afterEach(() => vi.unstubAllGlobals());

function streamArgs(overrides: Partial<StreamArgs> = {}): StreamArgs {
  return {
    messages: [{ id: 'm1', role: 'user', text: 'привет', ts: 0 }],
    onChunk: () => {},
    onComplete: () => {},
    onError: () => {},
    ...overrides,
  };
}

describe('LocalClaudeAdapter', () => {
  test('POSTs system + messages to chat-proxy and emits one onChunk', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      expect(body.system).toContain('test-system');
      expect(body.messages).toEqual([{ role: 'user', text: 'привет' }]);
      expect(body.model).toBe('sonnet');
      return new Response(JSON.stringify({ content: 'Привет!' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const chunks: string[] = [];
    let completed = false;
    const adapter = new LocalClaudeAdapter({ baseSystem: 'test-system' });
    await adapter.stream(streamArgs({
      onChunk: (c) => chunks.push(c),
      onComplete: () => { completed = true; },
    }));

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![0]).toBe('http://127.0.0.1:18791/chat');
    expect(chunks.join('')).toBe('Привет!');
    expect(completed).toBe(true);
  });

  test('uses overrideSystem when provided', async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      expect(body.system).toBe('OVERRIDE');
      return new Response(JSON.stringify({ content: 'ok' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new LocalClaudeAdapter({ baseSystem: 'BASE' });
    await adapter.stream(streamArgs({ overrideSystem: 'OVERRIDE' }));
  });

  test('reports HTTP error via onError, not onChunk', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream timeout', { status: 502 })));
    let errorMsg = '';
    const chunks: string[] = [];
    const adapter = new LocalClaudeAdapter({});
    await adapter.stream(streamArgs({
      onChunk: (c) => chunks.push(c),
      onError: (e) => { errorMsg = e.message; },
    }));
    expect(chunks).toEqual([]);
    expect(errorMsg).toContain('502');
  });

  test('honors custom baseUrl and model', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('http://localhost:9999/chat');
      const body = JSON.parse(String(init?.body ?? '{}'));
      expect(body.model).toBe('opus');
      return new Response(JSON.stringify({ content: 'x' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new LocalClaudeAdapter({ baseUrl: 'http://localhost:9999', model: 'opus' });
    await adapter.stream(streamArgs());
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
