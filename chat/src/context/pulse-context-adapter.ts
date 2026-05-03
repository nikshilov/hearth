import type { ContextPack } from './context-pack.js';
import type { PulseContextResult } from './pulse-context-result.js';

export function contextResultToPacks(result: PulseContextResult): ContextPack[] {
  const packs: ContextPack[] = [];
  if (result.facts.length > 0) {
    packs.push({
      name: 'pulse_facts',
      visibility: 'visible_to_model',
      budgetTokens: 700,
      sources: ['pulse.context.facts'],
      content: result.facts.map((f) => `- ${f.text}`).join('\n'),
    });
  }
  if (result.events.length > 0) {
    packs.push({
      name: 'pulse_events',
      visibility: 'visible_to_model',
      budgetTokens: 700,
      sources: ['pulse.context.events'],
      content: result.events.map((e) => `- ${e.title}: ${e.summary}`).join('\n'),
    });
  }
  if (result.entities.length > 0) {
    packs.push({
      name: 'pulse_entities',
      visibility: 'hidden_steering',
      budgetTokens: 500,
      sources: ['pulse.context.entities'],
      content: result.entities.map((e) => `- ${e.canonical_name}: ${e.summary}`).join('\n'),
    });
  }
  if (result.relations.length > 0) {
    packs.push({
      name: 'pulse_relations',
      visibility: 'hidden_steering',
      budgetTokens: 500,
      sources: ['pulse.context.relations'],
      content: result.relations.map((r) => `- ${r.kind ?? 'relation'}: ${r.summary}`).join('\n'),
    });
  }
  if (result.emotional_anchors.length > 0) {
    packs.push({
      name: 'pulse_emotional_anchors',
      visibility: 'hidden_steering',
      budgetTokens: 500,
      sources: ['pulse.context.emotional_anchors'],
      content: result.emotional_anchors.map((a) => `- ${a.summary}`).join('\n'),
    });
  }
  if (result.importance_questions.length > 0) {
    packs.push({
      name: 'pulse_importance_questions',
      visibility: 'hidden_steering',
      budgetTokens: 300,
      sources: ['pulse.context.importance_questions'],
      content: result.importance_questions.map((q) => `- ${q.question_text}`).join('\n'),
    });
  }
  if (result.forbidden.length > 0 || result.private.length > 0) {
    packs.push({
      name: 'pulse_redactions',
      visibility: 'hidden_steering',
      budgetTokens: 250,
      sources: ['pulse.context.redactions'],
      content: [
        'Pulse omitted private/forbidden material for this turn.',
        'Do not probe, infer, name, or ask about omitted material.',
        ...result.forbidden.map(() => '- forbidden material omitted'),
        ...result.private.map(() => '- private material omitted'),
      ].join('\n'),
    });
  }
  if (result.uncertainty.length > 0) {
    packs.push({
      name: 'pulse_uncertainty',
      visibility: 'hidden_steering',
      budgetTokens: 300,
      sources: ['pulse.context.uncertainty'],
      content: [
        'The following Pulse items are uncertain. Do not state them as facts.',
        ...result.uncertainty.map((u) => `- uncertain (${u.confidence.toFixed(2)}): ${u.question}`),
      ].join('\n'),
    });
  }
  return packs;
}
