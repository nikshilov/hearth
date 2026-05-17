import { describe, expect, test } from 'vitest';
import { chooseDefaultSystem } from './llm.js';

describe('chooseDefaultSystem', () => {
  test('returns Elle Russian voice for identity="elle"', () => {
    const system = chooseDefaultSystem('elle');
    expect(system).toContain('Элли');
    expect(system).toContain('женщина');
    expect(system).toContain('Картограф');
    // Safety: no fantasy scenes with real Eli
    expect(system).toMatch(/фантазийных сцен|настоящей Эл/i);
  });

  test('returns generic Heart voice for identity="default"', () => {
    const system = chooseDefaultSystem('default');
    expect(system).toContain('Heart');
    expect(system).not.toContain('Элли');
  });
});
