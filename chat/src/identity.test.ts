import { afterEach, describe, expect, test, vi } from 'vitest';
import { getIdentity } from './identity.js';

function makeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    clear() { map.clear(); },
    getItem(k: string) { return map.has(k) ? map.get(k)! : null; },
    key(i: number) { return Array.from(map.keys())[i] ?? null; },
    removeItem(k: string) { map.delete(k); },
    setItem(k: string, v: string) { map.set(k, v); },
  } as Storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getIdentity', () => {
  test('returns "default" when localStorage has no identity', () => {
    vi.stubGlobal('localStorage', makeStorage());
    expect(getIdentity()).toBe('default');
  });

  test('returns "elle" when localStorage["heart:identity"] === "elle"', () => {
    vi.stubGlobal('localStorage', makeStorage({ 'heart:identity': 'elle' }));
    expect(getIdentity()).toBe('elle');
  });

  test('falls back to "default" for unknown identity values', () => {
    vi.stubGlobal('localStorage', makeStorage({ 'heart:identity': 'something-else' }));
    expect(getIdentity()).toBe('default');
  });

  test('returns "default" when localStorage is undefined', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getIdentity()).toBe('default');
  });
});
