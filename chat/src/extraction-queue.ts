/**
 * Durable extraction queue (T0.8 from Heart ROADMAP, post-2026-05-18 code review).
 *
 * Wraps ContinuousExtractor with persistence, retry/backoff, and dead-letter.
 * The previous fire-and-forget model in orchestrator.fireExtraction silently
 * dropped failed extractions (LLM 429, JSON parse fail, timeout) — the reviewer
 * called this "the worst kind of memory bug: not obvious until weeks later
 * when the companion behaves like a stranger." This module makes it auditable.
 *
 * Storage:
 *   localStorage['heart:extraction-queue:v1']  — active queue (queued/running/failed-retry)
 *   localStorage['heart:extraction-dlq:v1']    — dead-letter (3+ attempts failed)
 *
 * Retry policy:
 *   max attempts = 3
 *   backoff      = exponential (1s, 4s, 16s)
 *   schedule     = in-memory setTimeout (lost on page reload — queue is
 *                  re-scanned on construct; queued/failed-retry jobs are
 *                  retried immediately on next boot)
 *
 * The queue is NOT a database — it's localStorage + setTimeout. Good enough
 * for personal alpha; v6 should move this to a real worker + IndexedDB.
 *
 * Anti-MF0 rule: this file caps at ~200 lines.
 */
import type { ContinuousExtractor, ExtractorTurn } from './continuous-extractor.js';
import type { ExtractionResult } from './cartographer.js';

const QUEUE_KEY = 'heart:extraction-queue:v1';
const DLQ_KEY = 'heart:extraction-dlq:v1';
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1_000, 4_000, 16_000];

export type ExtractionJobStatus = 'queued' | 'running' | 'failed' | 'applied';

export interface ExtractionJob {
  id: string;
  createdAt: string;
  /** ts strings of the user/assistant turns this job was scheduled to learn from */
  turnIds: string[];
  /** which Cartographer profile snapshot the job was scheduled against */
  profileRevision: number;
  attempts: number;
  status: ExtractionJobStatus;
  lastError?: string;
  rawResponse?: string;
  /** input payload for the extractor (so the job is re-runnable across reloads) */
  payload: {
    profile: unknown;
    recentTurns: ExtractorTurn[];
    observationDate?: string;
    retrievedEventIds?: number[];
  };
}

/**
 * Hook the queue invokes when an extraction job succeeds. Wires Cartographer
 * application — kept as a callback so this module stays decoupled.
 */
export type ApplyHook = (result: ExtractionResult, job: ExtractionJob) => void;

export class ExtractionQueue extends EventTarget {
  private jobs: ExtractionJob[] = [];
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private extractor: ContinuousExtractor,
    private applyHook: ApplyHook,
  ) {
    super();
    this.jobs = this.load();
    // Re-scan persisted queue on boot: anything left as 'running' from a
    // previous tab probably crashed mid-flight; reset to 'queued' so it retries.
    for (const job of this.jobs) {
      if (job.status === 'running') job.status = 'queued';
    }
    this.save();
    this.kickQueued();
  }

  enqueue(payload: ExtractionJob['payload'], profileRevision: number): ExtractionJob {
    const job: ExtractionJob = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      turnIds: payload.recentTurns.map((t) => t.ts),
      profileRevision,
      attempts: 0,
      status: 'queued',
      payload,
    };
    this.jobs.push(job);
    this.save();
    this.dispatchEvent(new CustomEvent('enqueued', { detail: job }));
    void this.run(job);
    return job;
  }

  /** Snapshot of current queue + DLQ for UI / debug surfacing. */
  snapshot(): { queue: ExtractionJob[]; dlq: ExtractionJob[] } {
    return {
      queue: [...this.jobs],
      dlq: this.loadDLQ(),
    };
  }

  /** Count of unresolved failures — surface as "N profile updates failed" badge. */
  failedCount(): number {
    return this.loadDLQ().length;
  }

  private kickQueued(): void {
    for (const job of this.jobs) {
      if (job.status === 'queued' || job.status === 'failed') {
        void this.run(job);
      }
    }
  }

  private async run(job: ExtractionJob): Promise<void> {
    if (job.status === 'applied' || job.status === 'running') return;
    job.status = 'running';
    job.attempts += 1;
    this.save();
    this.dispatchEvent(new CustomEvent('running', { detail: job }));

    let result: ExtractionResult | null = null;
    let errMsg: string | undefined;
    try {
      result = await this.extractor.extract(job.payload);
    } catch (e) {
      errMsg = e instanceof Error ? e.message : String(e);
    }

    // The extractor's own error path returns `{ patches: [], _notes: 'API error' | 'parse error' | ... }`.
    // Treat that as failure here (so we retry), not as success-with-no-patches.
    const extractorReportedFailure =
      result && result.patches.length === 0 && typeof result._notes === 'string'
        ? result._notes
        : undefined;

    if (errMsg || extractorReportedFailure) {
      job.lastError = errMsg ?? extractorReportedFailure;
      if (job.attempts >= MAX_ATTEMPTS) {
        // Move to DLQ. UI/debug surface can offer manual re-run.
        job.status = 'failed';
        this.moveToDLQ(job);
        this.dispatchEvent(new CustomEvent('deadLettered', { detail: job }));
      } else {
        job.status = 'failed';
        this.save();
        this.dispatchEvent(new CustomEvent('willRetry', { detail: job }));
        const delay = BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)];
        const timer = setTimeout(() => {
          this.timers.delete(job.id);
          job.status = 'queued';
          this.save();
          void this.run(job);
        }, delay);
        this.timers.set(job.id, timer);
      }
      return;
    }

    if (!result) {
      // Defensive — shouldn't reach here (either errMsg or result is set).
      job.lastError = 'extractor returned no result and no error';
      job.status = 'failed';
      this.moveToDLQ(job);
      return;
    }

    // Success path — apply via hook, mark applied, then evict from queue.
    job.status = 'applied';
    this.save();
    try {
      this.applyHook(result, job);
    } catch (e) {
      // applyHook failures don't go to DLQ — they're a Cartographer bug,
      // not a retry-worthy network failure. Surface for debug.
      console.error('extraction-queue: applyHook failed for job', job.id, e);
    }
    this.dispatchEvent(new CustomEvent('applied', { detail: job }));
    this.evict(job.id);
  }

  private moveToDLQ(job: ExtractionJob): void {
    const dlq = this.loadDLQ();
    dlq.push(job);
    try {
      localStorage.setItem(DLQ_KEY, JSON.stringify(dlq));
    } catch (e) {
      console.error('extraction-queue: DLQ save failed', e);
    }
    this.evict(job.id);
  }

  private evict(id: string): void {
    this.jobs = this.jobs.filter((j) => j.id !== id);
    const t = this.timers.get(id);
    if (t) {
      clearTimeout(t);
      this.timers.delete(id);
    }
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.jobs));
    } catch (e) {
      console.error('extraction-queue: queue save failed', e);
    }
  }

  private load(): ExtractionJob[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ExtractionJob[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('extraction-queue: load failed, starting empty', e);
      return [];
    }
  }

  private loadDLQ(): ExtractionJob[] {
    try {
      const raw = localStorage.getItem(DLQ_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as ExtractionJob[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
