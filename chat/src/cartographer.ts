/**
 * Cartographer — owner of the user's evolving profile.
 *
 * Two modes:
 *   - 'onboarding' — first session(s). System prompt is the cartographer
 *     onboarding prompt. No retrieval (Pulse is empty / not warmed yet).
 *   - 'normal' — companion mode. System prompt is the regular Heart
 *     companion prompt; profile biases retrieval and tone.
 *
 * Profile is stored as free-form JSON in localStorage. The continuous
 * extractor (Haiku) emits JSON Patches after each turn; this module
 * applies them. No Zod validation in MVP — schema enforcement comes
 * in Phase 2 when this moves to the Go pipeline.
 *
 * Anti-MF0 rule: this file caps at ~200 lines.
 */

const STORAGE_KEY = 'heart:cartographer:v1';
const ONBOARDING_TURN_TARGET = 25; // soft target — switch to normal around here

export type CartographerMode = 'onboarding' | 'normal';

export interface PatchOperation {
  path: string; // dot-path: "areas.hunger_map.primary_need"
  operation?: 'replace' | 'replace_if_higher_confidence' | 'append' | 'accumulate';
  value: unknown;
  user_words?: string[];
  evidence?: number[]; // event_ids from Pulse
  confidence?: number;
}

export interface ResistanceMarker {
  event_id?: number;
  marker: string;
  around_topic: string;
  verbatim: string;
  ts: string;
}

export interface ExtractionResult {
  patches: PatchOperation[];
  _resistance_observed?: ResistanceMarker[];
  _alert?: boolean;
  _contradiction?: unknown;
  _notes?: string;
}

export interface CartographerState {
  mode: CartographerMode;
  profile: Record<string, unknown>;
  resistance_log: ResistanceMarker[];
  turns_count: number;
  started_at: number;
  last_updated: number;
}

export class Cartographer extends EventTarget {
  state: CartographerState;

  constructor() {
    super();
    this.state = this.load();
  }

  private load(): CartographerState {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CartographerState;
        // Backfill missing fields from older shape
        if (!parsed.resistance_log) parsed.resistance_log = [];
        return parsed;
      }
    } catch (e) {
      console.warn('cartographer: failed to load state, starting fresh', e);
    }
    return this.fresh();
  }

  private fresh(): CartographerState {
    const now = Date.now();
    return {
      mode: 'onboarding',
      profile: {
        top_level: {
          created_at: new Date(now).toISOString(),
          updated_at: new Date(now).toISOString(),
        },
        areas: {},
      },
      resistance_log: [],
      turns_count: 0,
      started_at: now,
      last_updated: now,
    };
  }

  private save(): void {
    this.state.last_updated = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('cartographer: localStorage save failed', e);
    }
  }

  reset(): void {
    this.state = this.fresh();
    this.save();
    this.dispatchEvent(new CustomEvent('reset'));
    this.dispatchEvent(
      new CustomEvent('profileChanged', { detail: this.state.profile }),
    );
    this.dispatchEvent(
      new CustomEvent('modeChanged', { detail: this.state.mode }),
    );
  }

  forceMode(mode: CartographerMode): void {
    if (this.state.mode === mode) return;
    this.state.mode = mode;
    this.save();
    this.dispatchEvent(new CustomEvent('modeChanged', { detail: mode }));
  }

  bumpTurn(): void {
    this.state.turns_count += 1;
    this.save();
  }

  applyExtraction(result: ExtractionResult): void {
    let changed = false;
    for (const patch of result.patches ?? []) {
      try {
        this.applyPatch(patch);
        changed = true;
      } catch (e) {
        console.error('cartographer: bad patch', patch, e);
      }
    }
    for (const marker of result._resistance_observed ?? []) {
      this.state.resistance_log.push(marker);
      changed = true;
    }
    if (changed) {
      this.state.profile.top_level = {
        ...((this.state.profile.top_level as object) ?? {}),
        updated_at: new Date().toISOString(),
      };
      this.save();
      this.dispatchEvent(
        new CustomEvent('profileChanged', { detail: this.state.profile }),
      );
    }
  }

  private applyPatch(patch: PatchOperation): void {
    const parts = patch.path.split('.');
    if (!parts.length) throw new Error('empty path');

    // Navigate to parent
    let target: Record<string, unknown> = this.state.profile;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const cur = target[key];
      if (cur === undefined || cur === null || typeof cur !== 'object') {
        target[key] = {};
      }
      target = target[key] as Record<string, unknown>;
    }
    const lastKey = parts[parts.length - 1];
    const op = patch.operation ?? 'replace';

    if (op === 'append') {
      const existing = target[lastKey];
      const arr = Array.isArray(existing) ? existing.slice() : [];
      arr.push(patch.value);
      target[lastKey] = arr;
    } else if (op === 'accumulate') {
      const existing = typeof target[lastKey] === 'string' ? (target[lastKey] as string) : '';
      target[lastKey] = existing ? `${existing}\n${String(patch.value)}` : String(patch.value);
    } else if (op === 'replace_if_higher_confidence') {
      // T0.9 (Heart ROADMAP, post-2026-05-18 code review):
      // honest confidence comparison via sidecar map `profile._confidence`.
      // If patch has no confidence — fall back to replace (preserves
      // backward compat with extractor patches that don't yet emit it).
      // If existing has no confidence record — first write wins; subsequent
      // patches with lower confidence are dropped with a log.
      const existingConf = this.getConfidence(patch.path);
      const patchConf = patch.confidence;
      if (existingConf === undefined || patchConf === undefined || patchConf >= existingConf) {
        target[lastKey] = patch.value;
        if (patchConf !== undefined) {
          this.setConfidence(patch.path, patchConf);
        }
      } else {
        console.log(
          `cartographer: skipping ${patch.path} — existing confidence ${existingConf} > patch ${patchConf}`,
        );
      }
    } else {
      target[lastKey] = patch.value;
    }
  }

  private getConfidence(path: string): number | undefined {
    const conf = this.state.profile._confidence as Record<string, number> | undefined;
    return conf?.[path];
  }

  private setConfidence(path: string, value: number): void {
    const conf =
      (this.state.profile._confidence as Record<string, number> | undefined) ?? {};
    conf[path] = value;
    this.state.profile._confidence = conf;
  }

  /**
   * Heuristic: when should onboarding end?
   * MVP — soft target by turn count. Future: explicit Cartographer signal
   * (the prompt asks her to say "ну вот, карта основа есть" before handoff).
   */
  shouldSwitchToNormal(): boolean {
    return (
      this.state.mode === 'onboarding' &&
      this.state.turns_count >= ONBOARDING_TURN_TARGET
    );
  }
}

export const cartographer = new Cartographer();
