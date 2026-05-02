// @vitest-environment jsdom
import { beforeAll, describe, expect, test } from 'vitest';
import type { Message } from '../state.js';
import { ChatMessage } from './chat-message.js';

const TAG = 'chat-message-under-test';

beforeAll(() => {
  if (!customElements.get(TAG)) customElements.define(TAG, ChatMessage);
});

function makeNode(): ChatMessage {
  return document.createElement(TAG) as ChatMessage;
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

  test('does not enable memory metadata for debug=0', () => {
    history.replaceState(null, '', '/?debug=0');
    const node = makeNode();
    node.message = {
      id: 'm2',
      role: 'assistant',
      text: 'Без отладочной строки.',
      ts: Date.now(),
      retrieval: {
        event_ids: [7],
        mode_used: 'factual',
        confidence: 0.9,
        classifier: 'hybrid',
      },
    };

    expect(node.querySelector('memory-row')).toBeNull();
  });
});
