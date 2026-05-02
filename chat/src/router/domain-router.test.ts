import { describe, expect, test } from 'vitest';
import { routeConversation } from './domain-router.js';

describe('routeConversation', () => {
  test('routes a mixed Mila and choosing wound prompt to both domains', () => {
    const route = routeConversation(
      'Мила опять выглядит холодной, я не понимаю, это контент или она меня не выбирает',
    );

    expect(route.domains).toEqual(['mila', 'zasluzhivatel', 'life']);
    expect(route.sensitivity).toBe('high');
    expect(route.toolNeed).toBe('none');
    expect(route.confidence).toBeGreaterThan(0.8);
  });

  test('routes blocked Sonya writing with zasluzhivatel to book and inner-part work', () => {
    const route = routeConversation(
      'Я не могу писать Соню, как будто заслуживатель сел за руль',
    );

    expect(route.domains).toEqual(['book', 'zasluzhivatel']);
    expect(route.sensitivity).toBe('high');
    expect(route.reasons).toContain('matched book keywords');
    expect(route.reasons).toContain('matched zasluzhivatel keywords');
  });

  test('allows body context reads for tired body prompts', () => {
    const route = routeConversation('Что у меня с телом сегодня, я какой-то ватный');

    expect(route.domains).toEqual(['body']);
    expect(route.toolNeed).toBe('read_only');
    expect(route.reasons).toContain('matched body keywords');
  });

  test('routes task memory questions without over-eager calendar access', () => {
    const route = routeConversation('Напомни, что я обещал по garden-heart');

    expect(route.domains).toEqual(['tasks', 'memory_question', 'dev']);
    expect(route.toolNeed).toBe('read_only');
    expect(route.sensitivity).toBe('normal');
  });

  test('routes sleep questions to body without matching Sonya book rules', () => {
    const route = routeConversation('Как у меня сон сегодня, почему я ватный?');

    expect(route.domains).toEqual(['body']);
    expect(route.reasons).not.toContain('matched book keywords');
  });

  test('keeps ordinary vulnerable talk in life without forcing tools', () => {
    const route = routeConversation('Давай просто поговорим, мне опять холодно внутри');

    expect(route.domains).toEqual(['life']);
    expect(route.toolNeed).toBe('none');
    expect(route.sensitivity).toBe('sensitive');
  });
});
