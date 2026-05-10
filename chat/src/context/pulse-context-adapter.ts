import type { ContextPack } from './context-pack.js';
import type { PulseContextResult } from './pulse-context-result.js';

export function contextResultToPacks(result: PulseContextResult): ContextPack[] {
  const packs: ContextPack[] = [];
  // Pulse may serialize empty arrays as `null`. Normalize so downstream
  // .map / .length calls don't blow up the whole turn (regression: a
  // single null array silently aborted llm.stream).
  const facts = result.facts ?? [];
  const events = result.events ?? [];
  const entities = result.entities ?? [];
  const relations = result.relations ?? [];
  const anchors = result.emotional_anchors ?? [];
  const questions = result.importance_questions ?? [];
  const forbidden = result.forbidden ?? [];
  const privateItems = result.private ?? [];
  const uncertainty = result.uncertainty ?? [];

  // Defense in depth: even if Pulse forgot to filter, do not let
  // book-canon items render as plain "facts" / "events". Tag them so
  // the model can never quote them as reality. `meta_authorial` is
  // safe — it's the author's own commentary, not the in-book world.
  const isReality = (d?: string) => d === undefined || d === '' || d === 'real' || d === 'meta_authorial';
  const tagDomain = (d?: string) => (isReality(d) ? '' : ` [book:${d}]`);

  if (facts.length > 0) {
    packs.push({
      name: 'pulse_facts',
      visibility: 'visible_to_model',
      budgetTokens: 700,
      sources: ['pulse.context.facts'],
      content: facts.map((f) => `-${tagDomain(f.domain)} ${f.text}`).join('\n'),
    });
  }
  if (events.length > 0) {
    packs.push({
      name: 'pulse_events',
      visibility: 'visible_to_model',
      budgetTokens: 700,
      sources: ['pulse.context.events'],
      content: events.map((e) => `-${tagDomain(e.domain)} ${e.title}: ${e.summary}`).join('\n'),
    });
  }
  if (entities.length > 0) {
    packs.push({
      name: 'pulse_entities',
      visibility: 'hidden_steering',
      budgetTokens: 500,
      sources: ['pulse.context.entities'],
      content: entities.map((e) => `- ${e.canonical_name}: ${e.summary}`).join('\n'),
    });
  }
  if (relations.length > 0) {
    packs.push({
      name: 'pulse_relations',
      visibility: 'hidden_steering',
      budgetTokens: 500,
      sources: ['pulse.context.relations'],
      content: relations.map((r) => `- ${r.kind ?? 'relation'}: ${r.summary}`).join('\n'),
    });
  }
  if (anchors.length > 0) {
    packs.push({
      name: 'pulse_emotional_anchors',
      visibility: 'hidden_steering',
      budgetTokens: 500,
      sources: ['pulse.context.emotional_anchors'],
      content: anchors.map((a) => `- ${a.summary}`).join('\n'),
    });
  }
  if (questions.length > 0) {
    packs.push({
      name: 'pulse_importance_questions',
      visibility: 'hidden_steering',
      budgetTokens: 300,
      sources: ['pulse.context.importance_questions'],
      content: questions.map((q) => `- ${q.question_text}`).join('\n'),
    });
  }
  if (forbidden.length > 0 || privateItems.length > 0) {
    packs.push({
      name: 'pulse_redactions',
      visibility: 'hidden_steering',
      budgetTokens: 250,
      sources: ['pulse.context.redactions'],
      content: [
        'Pulse omitted private/forbidden material for this turn.',
        'Do not probe, infer, name, or ask about omitted material.',
        ...forbidden.map(() => '- forbidden material omitted'),
        ...privateItems.map(() => '- private material omitted'),
      ].join('\n'),
    });
  }
  if (uncertainty.length > 0) {
    packs.push({
      name: 'pulse_uncertainty',
      visibility: 'hidden_steering',
      budgetTokens: 300,
      sources: ['pulse.context.uncertainty'],
      content: [
        'The following Pulse items are uncertain. Do not state them as facts.',
        ...uncertainty.map((u) => `- uncertain (${u.confidence.toFixed(2)}): ${u.question}`),
      ].join('\n'),
    });
  }
  return packs;
}
