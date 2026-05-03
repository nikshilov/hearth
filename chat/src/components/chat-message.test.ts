// @vitest-environment jsdom
import { beforeAll, describe, expect, test } from 'vitest';
import type { Message } from '../state.js';
import { ChatMessage } from './chat-message.js';
import { MemoryRow } from './memory-row.js';

const TAG = 'chat-message-under-test';

beforeAll(() => {
  if (!customElements.get(TAG)) customElements.define(TAG, ChatMessage);
  if (!customElements.get('memory-row')) customElements.define('memory-row', MemoryRow);
});

function makeNode(): ChatMessage {
  return document.createElement(TAG) as ChatMessage;
}

function makePulseContext(patch = {}) {
  return {
    schema_version: 'pulse.context.v1' as const,
    query: 'test',
    mode_used: 'empathic',
    scope: 'nik',
    facts: [],
    emotional_anchors: [],
    events: [],
    entities: [],
    relations: [],
    forbidden: [],
    private: [],
    uncertainty: [],
    importance_questions: [],
    ...patch,
  };
}

describe('ChatMessage', () => {
  test('does not show memory metadata in default user-facing assistant message', () => {
    const node = makeNode();
    const message: Message = {
      id: 'm1',
      role: 'assistant',
      text: 'Я рядом.',
      ts: Date.now(),
      retrieval: {
        event_ids: [42],
        mode_used: 'empathic',
        confidence: 0.82,
        classifier: 'hybrid',
        reasoning: 'matched private memory',
      },
    };

    node.message = message;

    expect(node.textContent).toBe('Я рядом.');
    expect(node.querySelector('memory-row')).toBeNull();
  });

  test('shows typed context summary only in debug mode', () => {
    history.replaceState(null, '', '/?debug=1');
    const node = makeNode();
    node.message = {
      id: 'm3',
      role: 'assistant',
      text: 'Ответ.',
      ts: Date.now(),
      context: makePulseContext({
        facts: [{ id: 1, text: 'private fact text' }],
        forbidden: [{ subject_kind: 'entity', subject_id: 9, reason: 'safety boundary', policy: 'never-default' }],
      }),
    };

    expect(node.textContent).toContain('context used');
    expect(node.textContent).toContain('facts 1');
    expect(node.textContent).not.toContain('private fact text');
    expect(node.textContent).not.toContain('never-default');
  });
});
