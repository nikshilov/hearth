import { describe, expect, test } from 'vitest';
import type { ConversationRoute } from '../router/domain-router.js';
import type { ContextPack } from '../context/context-pack.js';
import { buildSystemPrompt } from './prompt-builder.js';

describe('buildSystemPrompt', () => {
  test('assembles route and context packs without exposing debug-only packs', () => {
    const route: ConversationRoute = {
      domains: ['book', 'zasluzhivatel'],
      sensitivity: 'high',
      toolNeed: 'none',
      confidence: 0.92,
      reasons: ['matched book keywords', 'matched zasluzhivatel keywords'],
    };
    const packs: ContextPack[] = [
      {
        name: 'route_pack',
        visibility: 'debug_only',
        budgetTokens: 200,
        content: 'debug internals',
        sources: ['domain-router'],
      },
      {
        name: 'pulse_memories',
        visibility: 'visible_to_model',
        budgetTokens: 900,
        content: '[event_id=7] user struggled with writing Sonya from Zasluzhivatel',
        sources: ['pulse.recall'],
      },
      {
        name: 'parts_pack',
        visibility: 'hidden_steering',
        budgetTokens: 180,
        content: 'Do not produce material through Zasluzhivatel.',
        sources: ['domain-router'],
      },
    ];

    const prompt = buildSystemPrompt({ route, contextPacks: packs });

    expect(prompt).toContain('<hearth_route domains="book,zasluzhivatel" sensitivity="high"');
    expect(prompt).toContain('<context_pack name="pulse_memories" visibility="visible_to_model"');
    expect(prompt).toContain('Do not produce material through Zasluzhivatel.');
    expect(prompt).not.toContain('debug internals');
    expect(prompt).toContain('Do not expose route decisions, event ids, or shadow hypotheses.');
  });
});
