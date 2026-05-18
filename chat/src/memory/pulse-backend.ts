/**
 * PulseMemoryBackend — implements MemoryBackend over the existing
 * PulseClient. Translates the generic MemoryContextRequest into a
 * Pulse contextQuery and the response into MemoryContext (with full
 * PulseContextResult preserved on `raw` for context-builder).
 */
import type { PulseClient } from '../api.js';
import type {
  MemoryBackend,
  MemoryContext,
  MemoryContextRequest,
  MemoryIngestTurn,
} from './backend.js';

export interface PulseBackendOptions {
  scope?: 'nik' | 'elle' | 'shared';
  audience?: string;
  privacyFloor?: string;
}

const DEFAULTS: Required<PulseBackendOptions> = {
  scope: 'nik',
  audience: 'heart_chat',
  privacyFloor: 'private',
};

export class PulseMemoryBackend implements MemoryBackend {
  constructor(
    private pulse: PulseClient,
    private opts: PulseBackendOptions = {},
  ) {}

  async ingestTurn(turn: MemoryIngestTurn): Promise<void> {
    // Errors here are swallowed by the caller (orchestrator) intentionally —
    // ingest is fire-and-forget. Surface via console for debugging.
    try {
      await this.pulse.ingest([
        { text: turn.text, ts: turn.ts ?? new Date().toISOString() },
      ]);
    } catch (e) {
      console.warn('pulse-backend: ingest failed', e);
      throw e; // caller decides whether to swallow
    }
  }

  async buildContext(req: MemoryContextRequest): Promise<MemoryContext | null> {
    const opts = { ...DEFAULTS, ...this.opts };
    try {
      const result = await this.pulse.contextQuery({
        query: req.query,
        mode: req.mode,
        top_k: req.topK,
        scope: opts.scope,
        audience: opts.audience,
        privacy_floor: opts.privacyFloor,
        user_state: req.userState,
        domain_hints: req.domainHints,
        domains_allowed: req.domainsAllowed,
        include_trace: req.includeTrace,
      });
      return {
        modeUsed: result.mode_used ?? 'unknown',
        classifier: 'heart:pulse-context',
        confidence: (result as { confidence?: number }).confidence ?? 0,
        reasoning: (result as { reasoning?: string }).reasoning,
        raw: result,
      };
    } catch (e) {
      console.warn('pulse-backend: contextQuery failed, returning null', e);
      return null;
    }
  }
}
