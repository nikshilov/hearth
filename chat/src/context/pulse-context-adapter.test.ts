import { describe, expect, test } from 'vitest';
import { contextResultToPacks } from './pulse-context-adapter.js';
import type { PulseContextResult } from './pulse-context-result.js';

function makeResult(patch: Partial<PulseContextResult>): PulseContextResult {
  return {
    schema_version: 'pulse.context.v1',
    query: 'почему меня не выбирают',
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

describe('contextResultToPacks', () => {
  test('renders Pulse typed result without leaking forbidden or uncertainty as facts', () => {
    const result = makeResult({
      facts: [{ id: 1, text: 'Nik needs to feel chosen without proving value', provenance: 'manual' }],
      emotional_anchors: [{ event_id: 10, summary: 'Choosing wound is emotionally central' }],
      forbidden: [{ subject_kind: 'entity', subject_id: 99, reason: 'safety boundary', policy: 'never-default' }],
      uncertainty: [{ subject_kind: 'fact', subject_id: 2, question: 'Maybe productivity armor', confidence: 0.4 }],
      importance_questions: [{ id: 5, question_text: 'Is this alive today or archive?', state: 'open' }],
    });

    const packs = contextResultToPacks(result);
    expect(packs.map((p) => p.name)).toEqual([
      'pulse_facts',
      'pulse_emotional_anchors',
      'pulse_importance_questions',
      'pulse_redactions',
      'pulse_uncertainty',
    ]);
    expect(packs.find((p) => p.name === 'pulse_facts')?.content).toContain('chosen without proving');
    expect(JSON.stringify(packs.find((p) => p.name === 'pulse_facts'))).not.toContain('never-default');
    expect(JSON.stringify(packs.find((p) => p.name === 'pulse_facts'))).not.toContain('Maybe productivity armor');
  });

  test('renders redactions as hidden constraints, not facts', () => {
    const result = makeResult({
      forbidden: [{ subject_kind: 'entity', subject_id: 99, reason: 'safety boundary', policy: 'never-default' }],
      private: [{ subject_kind: 'entity', subject_id: 42, reason: 'sensitive actor', policy: 'summary_only' }],
    });
    const packs = contextResultToPacks(result);
    const redactions = packs.find((p) => p.name === 'pulse_redactions');
    expect(redactions?.visibility).toBe('hidden_steering');
    expect(redactions?.content).toContain('private material omitted');
    expect(redactions?.content).not.toContain('summary_only');
    expect(redactions?.content).not.toContain('never-default');
    expect(packs.find((p) => p.name === 'pulse_facts')).toBeUndefined();
  });

  test('renders uncertainty separately from facts', () => {
    const result = makeResult({
      facts: [],
      uncertainty: [{ subject_kind: 'fact', subject_id: 2, question: 'Maybe productivity armor', confidence: 0.4 }],
    });
    const packs = contextResultToPacks(result);
    expect(packs.map((p) => p.name)).toContain('pulse_uncertainty');
    expect(packs.find((p) => p.name === 'pulse_facts')).toBeUndefined();
  });
});
