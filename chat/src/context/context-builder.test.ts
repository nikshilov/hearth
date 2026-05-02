import { describe, expect, test } from 'vitest';
import { routeConversation } from '../router/domain-router.js';
import { buildContextPacks } from './context-builder.js';

describe('buildContextPacks', () => {
  test('builds route, pulse, and relevant cartographer packs', () => {
    const route = routeConversation(
      'Мила опять выглядит холодной, я не понимаю, это контент или она меня не выбирает',
    );
    const packs = buildContextPacks({
      route,
      retrieval: {
        event_ids: [42],
        mode_used: 'empathic',
        confidence: 0.82,
        classifier: 'hybrid',
        reasoning: 'state and query matched',
      },
      retrievedTexts: new Map([[42, 'Никита связывает Милу с публичным выбором и тревогой быть невыбранным.']]),
      profile: {
        areas: {
          hunger_map: { primary_need: 'быть выбранным без доказательств' },
          relationship_history: { current_partner: 'Аня' },
        },
        shadow_material: [{ what_companion_sees: 'не показывать напрямую' }],
      },
      allowedCapabilities: [],
    });

    expect(packs.map((pack) => pack.name)).toEqual([
      'route_pack',
      'pulse_memories',
      'cartographer_profile',
      'mila_pack',
      'parts_pack',
    ]);
    expect(packs.find((pack) => pack.name === 'pulse_memories')?.content).toContain(
      'Никита связывает Милу',
    );
    expect(packs.find((pack) => pack.name === 'cartographer_profile')?.content).toContain(
      'быть выбранным без доказательств',
    );
    expect(packs.find((pack) => pack.name === 'cartographer_profile')?.content).not.toContain(
      'не показывать напрямую',
    );
  });

  test('omits pulse memory pack when only event ids are available without text', () => {
    const route = routeConversation('Напомни, что я обещал по garden-heart');
    const packs = buildContextPacks({
      route,
      retrieval: { event_ids: [9], mode_used: 'factual', confidence: 0.8, classifier: 'hybrid' },
      allowedCapabilities: [],
    });

    expect(packs.map((pack) => pack.name)).not.toContain('pulse_memories');
  });

  test('adds body pack only when health capability is allowed', () => {
    const route = routeConversation('Что у меня с телом сегодня, я какой-то ватный');
    const packs = buildContextPacks({
      route,
      retrieval: { event_ids: [], mode_used: 'empathic', confidence: 0.7, classifier: 'hybrid' },
      allowedCapabilities: [{ name: 'health.summary', domains: ['body'], access: 'silent', privacy: 'high' }],
    });

    expect(packs.map((pack) => pack.name)).toContain('body_pack');
    expect(packs.find((pack) => pack.name === 'body_pack')?.content).toContain('health.summary');
  });
});
