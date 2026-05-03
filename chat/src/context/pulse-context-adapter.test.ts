import { describe, expect, test } from 'vitest';
import { contextResultToPacks } from './pulse-context-adapter.js';
import type { PulseContextResult } from './pulse-context-result.js';

describe('contextResultToPacks', () => {
  test('renders Pulse typed result without leaking forbidden or uncertainty as facts', () => {
    const result: PulseContextResult = {
      schema_version: 'pulse.context.v1',
      query: 'почему меня не выбирают',
      mode_used: 'empathic',
      scope: 'nik',
      facts: [{ id: 1, text: 'Nik needs to feel chosen without proving value', provenance: 'manual' }],
      emotional_anchors: [{ event_id: 10, summary: 'Choosing wound is emotionally central' }],
      events: [],
      entities: [],
      relations: [],
      forbidden: [{ subject_kind: 'entity', subject_id: 99, reason: 'safety boundary', policy: 'never-default' }],
      private: [],
      uncertainty: [{ subject_kind: 'fact', subject_id: 2, question: 'Maybe productivity armor', confidence: 0.4 }],
      importance_questions: [{ id: 5, question_text: 'Is this alive today or archive?', state: 'open' }],
    };

    const packs = contextResultToPacks(result);
    expect(packs.map((p) => p.name)).toEqual(['pulse_facts', 'pulse_emotional_anchors', 'pulse_importance_questions']);
    expect(packs.find((p) => p.name === 'pulse_facts')?.content).toContain('chosen without proving');
    expect(JSON.stringify(packs)).not.toContain('never-default');
    expect(JSON.stringify(packs)).not.toContain('Maybe productivity armor');
  });
});
