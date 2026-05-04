// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { SettingsPanel } from './settings-panel.js';

const TAG = 'settings-panel-under-test';

beforeAll(() => {
  if (!customElements.get(TAG)) customElements.define(TAG, SettingsPanel);
});

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

function makeNode(): SettingsPanel {
  return document.createElement(TAG) as SettingsPanel;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SettingsPanel', () => {
  test('renders form fields and is hidden by default', () => {
    const node = makeNode();
    document.body.appendChild(node);
    expect(node.hasAttribute('open')).toBe(false);
    expect(node.querySelector('input[name="anthropic_key"]')).not.toBeNull();
    expect(node.querySelector('input[name="pulse_url"]')).not.toBeNull();
    expect(node.querySelector('input[name="pulse_key"]')).not.toBeNull();
    expect(node.querySelector('input[name="identity"][value="elle"]')).not.toBeNull();
    expect(node.querySelector('input[name="identity"][value="default"]')).not.toBeNull();
    expect(node.querySelector('textarea[name="system_override"]')).not.toBeNull();
    expect(node.querySelector('button[data-action="save"]')).not.toBeNull();
    document.body.removeChild(node);
  });

  test('open() sets the open attribute and close() removes it', () => {
    const node = makeNode();
    document.body.appendChild(node);
    node.open();
    expect(node.hasAttribute('open')).toBe(true);
    node.close();
    expect(node.hasAttribute('open')).toBe(false);
    document.body.removeChild(node);
  });

  test('loads existing values from localStorage on open', () => {
    vi.stubGlobal('localStorage', makeStorage({
      'anthropic:key': 'sk-test',
      'pulse:config': JSON.stringify({ baseUrl: 'http://x', apiKey: 'pk-test' }),
      'hearth:identity': 'elle',
      'hearth:system_override': 'CUSTOM PROMPT',
    }));

    const node = makeNode();
    document.body.appendChild(node);
    node.open();

    const anthropic = node.querySelector<HTMLInputElement>('input[name="anthropic_key"]')!;
    const pulseUrl = node.querySelector<HTMLInputElement>('input[name="pulse_url"]')!;
    const pulseKey = node.querySelector<HTMLInputElement>('input[name="pulse_key"]')!;
    const elleRadio = node.querySelector<HTMLInputElement>('input[name="identity"][value="elle"]')!;
    const override = node.querySelector<HTMLTextAreaElement>('textarea[name="system_override"]')!;

    expect(anthropic.value).toBe('sk-test');
    expect(pulseUrl.value).toBe('http://x');
    expect(pulseKey.value).toBe('pk-test');
    expect(elleRadio.checked).toBe(true);
    expect(override.value).toBe('CUSTOM PROMPT');

    document.body.removeChild(node);
  });

  test('save() writes all fields to localStorage and closes', () => {
    const node = makeNode();
    document.body.appendChild(node);
    node.open();

    node.querySelector<HTMLInputElement>('input[name="anthropic_key"]')!.value = 'sk-new';
    node.querySelector<HTMLInputElement>('input[name="pulse_url"]')!.value = 'http://localhost:18790';
    node.querySelector<HTMLInputElement>('input[name="pulse_key"]')!.value = 'pk-new';
    node.querySelector<HTMLInputElement>('input[name="identity"][value="elle"]')!.checked = true;
    node.querySelector<HTMLTextAreaElement>('textarea[name="system_override"]')!.value = '';

    node.save();

    expect(localStorage.getItem('anthropic:key')).toBe('sk-new');
    expect(JSON.parse(localStorage.getItem('pulse:config') ?? '{}')).toEqual({
      baseUrl: 'http://localhost:18790',
      apiKey: 'pk-new',
    });
    expect(localStorage.getItem('hearth:identity')).toBe('elle');
    expect(localStorage.getItem('hearth:system_override')).toBeNull();
    expect(node.hasAttribute('open')).toBe(false);

    document.body.removeChild(node);
  });

  test('save() persists non-empty system override', () => {
    const node = makeNode();
    document.body.appendChild(node);
    node.open();
    node.querySelector<HTMLInputElement>('input[name="anthropic_key"]')!.value = 'k';
    node.querySelector<HTMLTextAreaElement>('textarea[name="system_override"]')!.value = 'MY VOICE';
    node.save();
    expect(localStorage.getItem('hearth:system_override')).toBe('MY VOICE');
    document.body.removeChild(node);
  });

  test('resetPrompt() clears the override field and storage', () => {
    vi.stubGlobal('localStorage', makeStorage({ 'hearth:system_override': 'OLD' }));
    const node = makeNode();
    document.body.appendChild(node);
    node.open();
    expect(node.querySelector<HTMLTextAreaElement>('textarea[name="system_override"]')!.value).toBe('OLD');
    node.resetPrompt();
    expect(node.querySelector<HTMLTextAreaElement>('textarea[name="system_override"]')!.value).toBe('');
    expect(localStorage.getItem('hearth:system_override')).toBeNull();
    document.body.removeChild(node);
  });
});
