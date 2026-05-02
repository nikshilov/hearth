import { describe, expect, test } from 'vitest';
import { routeConversation } from '../router/domain-router.js';
import { allowedCapabilitiesFor } from './tool-policy.js';

describe('allowedCapabilitiesFor', () => {
  test('always allows Pulse recall and ingest silently', () => {
    const route = routeConversation('Давай просто поговорим, мне опять холодно внутри');

    expect(allowedCapabilitiesFor(route).map((c) => c.name)).toEqual([
      'pulse.recall',
      'pulse.ingest',
    ]);
  });

  test('allows health summary only for body routes', () => {
    const route = routeConversation('Что у меня с телом сегодня, я какой-то ватный');

    expect(allowedCapabilitiesFor(route).map((c) => c.name)).toEqual([
      'pulse.recall',
      'pulse.ingest',
      'health.summary',
    ]);
  });

  test('keeps generic remembered promises Pulse-first without calendar or gmail', () => {
    const route = routeConversation('Напомни, что я обещал по garden-heart');

    expect(allowedCapabilitiesFor(route).map((c) => c.name)).toEqual([
      'pulse.recall',
      'pulse.ingest',
    ]);
  });

  test('allows read-only calendar and gmail for explicit schedule or mail routes', () => {
    const route = routeConversation('Проверь календарь и письмо по сегодняшней встрече');

    expect(allowedCapabilitiesFor(route).map((c) => c.name)).toEqual([
      'pulse.recall',
      'pulse.ingest',
      'calendar.read',
      'gmail.read',
    ]);
  });

  test('never allows disabled or dev-only capabilities by default', () => {
    const route = routeConversation('Нужно закоммитить и проверить tests в branch');
    const names = allowedCapabilitiesFor(route).map((c) => c.name);

    expect(names).not.toContain('reddit');
    expect(names).not.toContain('mobile');
    expect(names).not.toContain('playwright');
    expect(names).toEqual(['pulse.recall', 'pulse.ingest']);
  });
});
