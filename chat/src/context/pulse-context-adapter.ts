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
  return packs;
}
