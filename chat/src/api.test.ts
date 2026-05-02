import { describe, expect, test } from 'vitest';
import { normalizeIngestObservations } from './api.js';

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
