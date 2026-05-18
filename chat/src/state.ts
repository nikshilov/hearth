/**
 * Reactive app state. Native EventTarget — no Pinia/Zustand/Redux.
 * Components subscribe via `state.addEventListener(eventName, handler)`.
 *
 * Anti-MF0-monolith rule: this file is the ONLY source of truth for
 * state mutations. Components must NEVER mutate state directly; they call
 * the methods below (each fires a typed event downstream).
 */
import type { PulseContextResult } from './context/pulse-context-result.js';
import type { RetrieveResponse, RouteDecision, UserState } from './api.js';

export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: Role;
  text: string;
  ts: number;
  context?: PulseContextResult;
  retrieval?: RetrieveResponse;
  streaming?: boolean;
}

export type StateEventName =
  | 'messageAppended'
  | 'messageUpdated'
  | 'retrievalAttached'
  | 'userStateChanged'
  | 'routerDecisionAppended';

export class AppState extends EventTarget {
  messages: Message[] = [];
  userState: UserState = { mood_vector: {} };
  routerLog: Array<RouteDecision & { ts: number; query: string }> = [];

  /**
   * Monotonic counter incremented on every mutation. Components can compare
   * a captured `stateRevision` against `state.stateRevision` to detect that
   * state changed under them while they were doing async work (Pulse query,
   * LLM stream). Orchestrator uses this to snapshot user_state at turn start
   * so retrieval is grounded in the state the user saw when typing, not
   * whatever happened to be live when Pulse responded.
   */
  stateRevision = 0;

  /**
   * Return a frozen deep clone of `userState` plus the revision number at
   * the time of capture. Use this at the start of a turn; pass the cloned
   * object into Pulse / LLM. Mutations to `userState` after snapshot do
   * NOT affect the returned object.
   */
  snapshotUserState(): { state: UserState; revision: number } {
    return {
      state: structuredClone(this.userState),
      revision: this.stateRevision,
    };
  }

  appendUser(text: string): Message {
    const m: Message = {
      id: cryptoId(),
      role: 'user',
      text,
      ts: Date.now(),
    };
    this.messages.push(m);
    this.stateRevision += 1;
    this.dispatchEvent(new CustomEvent('messageAppended', { detail: m }));
    return m;
  }

  appendSystem(text: string): Message {
    const m: Message = {
      id: cryptoId(),
      role: 'system',
      text,
      ts: Date.now(),
    };
    this.messages.push(m);
    this.stateRevision += 1;
    this.dispatchEvent(new CustomEvent('messageAppended', { detail: m }));
    return m;
  }

  appendAssistantStart(): Message {
    const m: Message = {
      id: cryptoId(),
      role: 'assistant',
      text: '',
      ts: Date.now(),
      streaming: true,
    };
    this.messages.push(m);
    this.stateRevision += 1;
    this.dispatchEvent(new CustomEvent('messageAppended', { detail: m }));
    return m;
  }

  appendAssistantChunk(messageId: string, chunk: string): void {
    const m = this.messages.find((x) => x.id === messageId);
    if (!m) return;
    m.text += chunk;
    this.dispatchEvent(new CustomEvent('messageUpdated', { detail: m }));
  }

  finishAssistant(messageId: string): void {
    const m = this.messages.find((x) => x.id === messageId);
    if (!m) return;
    m.streaming = false;
    this.dispatchEvent(new CustomEvent('messageUpdated', { detail: m }));
  }

  attachRetrievalMeta(messageId: string, meta: RetrieveResponse): void {
    const m = this.messages.find((x) => x.id === messageId);
    if (!m) return;
    m.retrieval = meta;
    this.dispatchEvent(new CustomEvent('retrievalAttached', { detail: m }));
  }

  attachContextMeta(messageId: string, context: PulseContextResult): void {
    const m = this.messages.find((x) => x.id === messageId);
    if (!m) return;
    m.context = context;
    this.dispatchEvent(new CustomEvent('retrievalAttached', { detail: m }));
  }

  setUserState(patch: Partial<UserState>): void {
    this.userState = mergeUserState(this.userState, patch);
    this.stateRevision += 1;
    this.dispatchEvent(
      new CustomEvent('userStateChanged', { detail: this.userState }),
    );
  }

  appendRouterDecision(d: RouteDecision, query: string): void {
    const entry = { ...d, ts: Date.now(), query };
    this.routerLog.push(entry);
    this.dispatchEvent(
      new CustomEvent('routerDecisionAppended', { detail: entry }),
    );
  }
}

function cryptoId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function mergeUserState(prev: UserState, patch: Partial<UserState>): UserState {
  const next: UserState = { ...prev, ...patch };
  if (patch.mood_vector) {
    next.mood_vector = { ...prev.mood_vector, ...patch.mood_vector };
  }
  return next;
}

// Singleton instance — components import this directly.
export const state = new AppState();
