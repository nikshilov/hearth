/**
 * Pulse HTTP client — talks to Pulse Go server (POST /retrieve, /ingest).
 * Mirrors `pulse/mcp/src/index.ts:pulseFetch` shape; keep these in sync.
 *
 * On iOS (when bundled in WKWebView), routes through the `pulse_http` Swift
 * bridge instead of direct fetch (CORS + ATS friction). Detect via
 * `window.webkit?.messageHandlers?.pulse_http`.
 */

import type { PulseContextResult } from './context/pulse-context-result.js';

export type QueryMode = 'auto' | 'factual' | 'empathic' | 'chain';

export interface UserState {
  mood_vector?: Record<string, number>;
  sleep_quality?: number;
  sleep_hours?: number;
  hrv?: number;
  hr_trend?: string;
  hrv_trend?: string;
  stress_proxy?: number;
  recent_life_events_7d?: string[];
  time_of_day?: string;
  snapshot_days_ago?: number;
}

export interface RetrieveRequest {
  query: string;
  mode?: QueryMode;
  top_k?: number;
  user_state?: UserState;
}

export interface RetrieveResponse {
  event_ids: number[];
  mode_used: string;
  confidence: number;
  classifier: string;
  reasoning?: string;
}

export interface ContextQueryRequest {
  query: string;
  mode?: QueryMode;
  top_k?: number;
  scope?: 'nik' | 'elle' | 'shared';
  audience?: string;
  privacy_floor?: string;
  include_trace?: boolean;
  user_state?: UserState;
  domain_hints?: string[];
  // Hard whitelist for fact/event domains. Pulse drops items whose
  // `domain` (real | fiction_content | fiction_meta | meta_authorial)
  // is not in this list. Empty/undefined = no filter — use only for
  // book-work tooling, never for the normal chat path.
  domains_allowed?: Array<'real' | 'fiction_content' | 'fiction_meta' | 'meta_authorial'>;
}

export interface RouteDecision {
  mode: string;
  confidence: number;
  classifier: string;
  reasoning?: string;
}

export interface PulseObservation {
  source_kind: 'heart_chat';
  source_id: string;
  scope: 'nik' | 'elle' | 'shared';
  captured_at: string;
  observed_at: string;
  version: number;
  content_text: string;
  metadata: { client: 'heart' };
}
export interface IngestObservation {
  text: string;
  ts?: string;
  scope?: 'nik' | 'elle' | 'shared';
}

export interface PulseConfig {
  baseUrl: string;
  apiKey: string;
}

export class PulseHTTPError extends Error {
  constructor(public status: number, public path: string, message: string) {
    super(message);
    this.name = 'PulseHTTPError';
  }
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        pulse_http?: { postMessage(msg: unknown): void };
      };
    };
    __pulseHTTPResponse?: (id: string, body: unknown) => void;
  }
}

export class PulseClient {
  constructor(private cfg: PulseConfig) {}

  async recall(req: RetrieveRequest): Promise<RetrieveResponse> {
    return await this.post<RetrieveResponse>('/retrieve', req);
  }

  async contextQuery(req: ContextQueryRequest): Promise<PulseContextResult> {
    const result = await this.post<PulseContextResult>('/context/query', req);
    if (result.schema_version !== 'pulse.context.v1') {
      throw new Error(
        `Unsupported Pulse context schema: ${String(
          (result as { schema_version?: unknown }).schema_version,
        )}`,
      );
    }
    return result;
  }

  async ingest(observations: IngestObservation[]): Promise<{ ok: boolean }> {
    return await this.post('/ingest', {
      observations: normalizeIngestObservations(observations),
    });
  }

  private async post<T>(path: string, body: unknown, timeoutMs = 15_000): Promise<T> {
    if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.pulse_http) {
      return await iosBridgePost<T>(path, body, this.cfg);
    }
    const url = `${this.cfg.baseUrl.replace(/\/$/, '')}${path}`;
    // T0.11 (Heart ROADMAP, post-2026-05-18 code review): browser fetch
    // has no default timeout. A Pulse server that accepts the connection
    // and hangs would leave orchestrator waiting forever and the user
    // staring at no typing indicator. AbortController bounds the wait.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.cfg.apiKey ? { 'X-Pulse-Key': this.cfg.apiKey } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new PulseHTTPError(
          resp.status,
          path,
          `Pulse HTTP ${resp.status} on ${path}: ${text.slice(0, 500)}`,
        );
      }
      return (await resp.json()) as T;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new PulseHTTPError(
          0,
          path,
          `Pulse timeout after ${timeoutMs}ms on ${path}`,
        );
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export function normalizeIngestObservations(observations: IngestObservation[]): PulseObservation[] {
  return observations.map((observation) => {
    const ts = observation.ts ?? new Date().toISOString();
    return {
      source_kind: 'heart_chat',
      source_id: `heart_chat:${ts}`,
      scope: observation.scope ?? 'nik',
      captured_at: ts,
      observed_at: ts,
      version: 1,
      content_text: observation.text,
      metadata: { client: 'heart' },
    };
  });
}

const pendingBridgeCalls = new Map<string, (body: unknown) => void>();

function iosBridgePost<T>(
  path: string,
  body: unknown,
  _cfg: PulseConfig,
): Promise<T> {
  const id = Math.random().toString(36).slice(2, 12);
  return new Promise<T>((resolve, reject) => {
    pendingBridgeCalls.set(id, (resp) => {
      const r = resp as { ok: boolean; status?: number; body?: unknown; error?: string };
      if (r.ok) resolve(r.body as T);
      else reject(new Error(r.error ?? `iOS bridge failed status=${r.status}`));
    });
    window.webkit!.messageHandlers!.pulse_http!.postMessage({
      id, path, body,
    });
    setTimeout(() => {
      if (pendingBridgeCalls.has(id)) {
        pendingBridgeCalls.delete(id);
        reject(new Error(`iOS bridge timeout on ${path}`));
      }
    }, 30_000);
  });
}

if (typeof window !== 'undefined') {
  window.__pulseHTTPResponse = (id, body) => {
    const cb = pendingBridgeCalls.get(id);
    if (!cb) return;
    pendingBridgeCalls.delete(id);
    cb(body);
  };
}

/** Build a default Pulse client from env / localStorage / sane defaults. */
export function makeClient(): PulseClient {
  const stored = localStorage.getItem('pulse:config');
  const fallback: PulseConfig = {
    baseUrl: 'http://127.0.0.1:18789',
    apiKey: '',
  };
  if (!stored) return new PulseClient(fallback);
  try {
    const parsed = JSON.parse(stored) as Partial<PulseConfig>;
    return new PulseClient({ ...fallback, ...parsed });
  } catch {
    return new PulseClient(fallback);
  }
}
