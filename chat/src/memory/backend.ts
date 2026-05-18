/**
 * MemoryBackend — abstraction over the memory engine (T0.10 from Heart
 * ROADMAP, post-2026-05-18 code review).
 *
 * Before this interface, orchestrator depended directly on PulseClient
 * and passed Pulse-specific fields (scope, audience, privacy_floor,
 * domain_hints, domains_allowed) through to retrieval. That made it
 * impossible to swap memory backend (Mem0 / claude-mem / no-memory) by
 * changing api.ts alone — the Pulse contract had leaked all the way
 * into orchestrator.
 *
 * This interface gives orchestrator a narrow port. Two concrete impls:
 *   - PulseMemoryBackend  — wraps the existing PulseClient
 *   - NoMemoryBackend     — for debug / fixtures / Pulse-down testing
 *
 * Future: Mem0Backend, ClaudeMemBackend for cross-model bench (Heart
 * ROADMAP T1.3 — felt-continuity bench).
 *
 * Honest scope: orchestrator + context-builder still touch the Pulse
 * response shape via `MemoryContext.raw` (escape hatch). Full decoupling
 * of context-builder is v6 work. This commit ships the interface +
 * swappable wiring; the orchestrator does not import PulseClient
 * directly anymore.
 */
import type { PulseContextResult } from '../context/pulse-context-result.js';
import type { UserState } from '../api.js';

export type MemoryQueryMode = 'auto' | 'factual' | 'empathic' | 'chain';

export interface MemoryContextRequest {
  query: string;
  mode?: MemoryQueryMode;
  topK?: number;
  userState?: UserState;
  domainHints?: string[];
  /**
   * Hard whitelist for fact/event domains. Backends that don't model
   * fiction/real distinction MUST ignore this field.
   */
  domainsAllowed?: Array<'real' | 'fiction_content' | 'fiction_meta' | 'meta_authorial'>;
  includeTrace?: boolean;
}

/**
 * Generic memory context shape exposed to orchestrator. Hides backend
 * specifics behind a small surface; backends that return richer data
 * (PulseContextResult with facts/events/entities/relations/anchors/
 * redactions) stash the full object in `raw` for callers that need it
 * (context-builder + state.attachContextMeta currently do).
 */
export interface MemoryContext {
  /** Routing decision metadata (for state.appendRouterDecision). */
  modeUsed: string;
  classifier: string;
  confidence: number;
  reasoning?: string;
  /**
   * Backend-specific full response. PulseMemoryBackend stashes the
   * PulseContextResult here. Other backends should stash their own
   * native response so a future swap-aware context-builder can read it.
   */
  raw: PulseContextResult | unknown;
}

export interface MemoryIngestTurn {
  text: string;
  ts?: string;
}

export interface MemoryBackend {
  /**
   * Persist a turn to memory. Fire-and-forget is acceptable for callers
   * (orchestrator ignores errors and continues); the backend's own
   * implementation MAY retry internally.
   */
  ingestTurn(turn: MemoryIngestTurn, signal?: AbortSignal): Promise<void>;

  /**
   * Retrieve memory context for the current turn. Returns null on
   * failure (caller continues without context). Throwing is allowed
   * only for programmer errors (bad request shape) — network/server
   * failures should resolve to null.
   */
  buildContext(req: MemoryContextRequest, signal?: AbortSignal): Promise<MemoryContext | null>;
}

/**
 * No-op backend for environments where memory is unavailable (server
 * down, Pulse not configured, isolated tests). ingestTurn silently
 * accepts; buildContext returns null so orchestrator falls back to
 * memory-less response.
 */
export class NoMemoryBackend implements MemoryBackend {
  async ingestTurn(_turn: MemoryIngestTurn): Promise<void> {
    // intentionally empty
  }
  async buildContext(): Promise<MemoryContext | null> {
    return null;
  }
}
