import { afterEach, describe, expect, test, vi } from 'vitest';
import { normalizeIngestObservations, PulseClient, PulseHTTPError } from './api.js';

describe('normalizeIngestObservations', () => {
  test('converts Hearth shorthand observations into Pulse capture observations', () => {
    expect(
      normalizeIngestObservations([
        { text: 'Привет из Hearth', ts: '2026-05-02T04:00:00.000Z' },
      ]),
    ).toEqual([
      {
        source_kind: 'hearth_chat',
        source_id: 'hearth_chat:2026-05-02T04:00:00.000Z',
        scope: 'nik',
        captured_at: '2026-05-02T04:00:00.000Z',
        observed_at: '2026-05-02T04:00:00.000Z',
        version: 1,
        content_text: 'Привет из Hearth',
        metadata: { client: 'hearth' },
      },
    ]);
  });
});

afterEach(() => vi.restoreAllMocks());

describe('PulseClient.contextQuery', () => {
  test('posts typed context query to /context/query', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      schema_version: 'pulse.context.v1',
      query: 'hello',
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
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new PulseClient({ baseUrl: 'http://pulse.test', apiKey: 'secret' });
    const result = await client.contextQuery({ query: 'hello', scope: 'nik', domain_hints: ['life'] });

    expect(result.schema_version).toBe('pulse.context.v1');
    expect(fetchMock).toHaveBeenCalledWith('http://pulse.test/context/query', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'X-Pulse-Key': 'secret' }),
      body: JSON.stringify({ query: 'hello', scope: 'nik', domain_hints: ['life'] }),
    }));
  });

  test('throws PulseHTTPError with status for non-OK responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('context query not configured', { status: 503 })));
    const client = new PulseClient({ baseUrl: 'http://pulse.test', apiKey: 'secret' });

    await expect(client.contextQuery({ query: 'hello' })).rejects.toMatchObject({
      name: 'PulseHTTPError',
      status: 503,
      path: '/context/query',
    });
  });
});
