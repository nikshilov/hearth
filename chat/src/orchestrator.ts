/**
 * Orchestrator — single owner of the user-types-to-AI-replies flow.
 *
 * Two modes:
 *   - 'onboarding' — Cartographer drives. No Pulse retrieval (memory empty
 *     / not warmed). System prompt = cartographer onboarding prompt.
 *   - 'normal' — companion mode. Standard ingest + recall + stream flow.
 *
 * After each user→assistant exchange, runs continuous-extractor (Haiku)
 * in the background. Extractor patches the profile silently.
 *
 * Anti-MF0 rule: this file caps at ~200 lines.
 */
import type { PulseClient } from './api.js';
import type { StreamArgs } from './llm.js';
import type { AppState } from './state.js';

/** Public surface the orchestrator uses — `MockClaudeAdapter` satisfies this too. */
export interface LLMStreamer {
  stream(args: StreamArgs): Promise<void>;
}
import { pulseBurst } from './components/heart-pulse.js';
import { cartographer } from './cartographer.js';
import { ONBOARDING_PROMPT_RU } from './cartographer-prompts.js';
import {
  makeExtractor,
  turnsFromMessages,
  type ContinuousExtractor,
} from './continuous-extractor.js';

interface OrchestratorDeps {
  pulse: PulseClient;
  llm: LLMStreamer | null;
  state: AppState;
}

let deps: OrchestratorDeps | null = null;
let extractor: ContinuousExtractor | null = null;

export function setOrchestrator(d: OrchestratorDeps): void {
  deps = d;
  extractor = makeExtractor();
  document.addEventListener('composer:send', onComposerSend as EventListener);
}

async function onComposerSend(ev: Event): Promise<void> {
  if (!deps) return;
  const detail = (ev as CustomEvent<{ text: string }>).detail;
  const text = detail.text.trim();
  if (!text) return;

  cartographer.bumpTurn();

  if (cartographer.state.mode === 'onboarding') {
    await runOnboardingTurn(text);
  } else {
    await runNormalTurn(text);
  }

  // Soft transition: once we've collected enough, leave onboarding.
  if (cartographer.shouldSwitchToNormal()) {
    cartographer.forceMode('normal');
    deps.state.appendSystem(
      'картограф закончила. дальше — обычный разговор. карта продолжит дополняться по ходу.',
    );
  }

  // Post-turn extraction in background — never blocks UX.
  fireExtraction().catch((e) =>
    console.error('background extraction failed:', e),
  );
}

async function runOnboardingTurn(text: string): Promise<void> {
  if (!deps) return;
  const { llm, state } = deps;

  state.appendUser(text);

  if (!llm) {
    state.appendSystem(
      '[no AI key set] add anthropic:key in localStorage and reload — картограф не сможет говорить без неё.',
    );
    return;
  }

  const assistantMsg = state.appendAssistantStart();
  try {
    await llm.stream({
      messages: state.messages.slice(0, -1),
      overrideSystem: ONBOARDING_PROMPT_RU,
      onChunk: (chunk) => state.appendAssistantChunk(assistantMsg.id, chunk),
      onComplete: () => state.finishAssistant(assistantMsg.id),
      onError: (err) => {
        state.appendAssistantChunk(assistantMsg.id, `\n\n[LLM error: ${err.message}]`);
        state.finishAssistant(assistantMsg.id);
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    state.appendAssistantChunk(assistantMsg.id, `[stream error: ${msg}]`);
    state.finishAssistant(assistantMsg.id);
  }
}

async function runNormalTurn(text: string): Promise<void> {
  if (!deps) return;
  const { pulse, llm, state } = deps;

  state.appendUser(text);

  // Fire ingest in parallel; don't await
  pulse.ingest([{ text, ts: new Date().toISOString() }]).catch((e) => {
    console.error('ingest failed:', e);
    state.appendSystem(`ingest error: ${e.message}`);
  });

  let retrieval;
  try {
    pulseBurst();
    retrieval = await pulse.recall({
      query: text,
      mode: 'auto',
      top_k: 5,
      user_state: state.userState,
    });
    state.appendRouterDecision(
      {
        mode: retrieval.mode_used,
        confidence: retrieval.confidence,
        classifier: retrieval.classifier,
        reasoning: retrieval.reasoning,
      },
      text,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    state.appendSystem(`recall error: ${msg}`);
    return;
  }

  if (!llm) {
    state.appendSystem(
      `[no AI key set] retrieval: mode=${retrieval.mode_used}, ` +
        `events=${retrieval.event_ids.join(',')}, ` +
        `classifier=${retrieval.classifier} (${retrieval.confidence.toFixed(2)})`,
    );
    return;
  }

  const assistantMsg = state.appendAssistantStart();
  try {
    await llm.stream({
      messages: state.messages.slice(0, -1),
      retrieved: retrieval,
      onChunk: (chunk) => state.appendAssistantChunk(assistantMsg.id, chunk),
      onComplete: () => {
        state.attachRetrievalMeta(assistantMsg.id, retrieval);
        state.finishAssistant(assistantMsg.id);
      },
      onError: (err) => {
        state.appendAssistantChunk(assistantMsg.id, `\n\n[LLM error: ${err.message}]`);
        state.finishAssistant(assistantMsg.id);
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    state.appendAssistantChunk(assistantMsg.id, `[stream error: ${msg}]`);
    state.finishAssistant(assistantMsg.id);
  }
}

async function fireExtraction(): Promise<void> {
  if (!deps || !extractor) return;
  const recent = turnsFromMessages(deps.state.messages, 4);
  if (recent.length < 2) return; // need at least one user + one assistant
  const result = await extractor.extract({
    profile: cartographer.state.profile,
    recentTurns: recent,
  });
  if (result.patches.length > 0 || (result._resistance_observed?.length ?? 0) > 0) {
    cartographer.applyExtraction(result);
  }
}
