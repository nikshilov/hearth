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
import type { PulseContextResult } from './context/pulse-context-result.js';
import type { StreamArgs } from './llm.js';
import type { AppState } from './state.js';
import type { MemoryBackend } from './memory/backend.js';

/** Public surface the orchestrator uses — `MockClaudeAdapter` satisfies this too. */
export interface LLMStreamer {
  stream(args: StreamArgs): Promise<void>;
}
import { buildContextPacks } from './context/context-builder.js';
import { routeConversation } from './router/domain-router.js';
import { allowedCapabilitiesFor } from './tools/tool-policy.js';
import { pulseBurst } from './components/heart-pulse.js';
import { cartographer } from './cartographer.js';
import { ONBOARDING_PROMPT_RU } from './cartographer-prompts.js';
import { makeExtractor, turnsFromMessages } from './continuous-extractor.js';
import { ExtractionQueue } from './extraction-queue.js';

export interface OrchestratorDeps {
  /**
   * Memory backend abstraction (T0.10). orchestrator no longer depends on
   * PulseClient directly — any MemoryBackend impl works. PulseMemoryBackend
   * wraps the existing PulseClient. NoMemoryBackend is the test/no-server
   * fallback.
   */
  memory: MemoryBackend;
  llm: LLMStreamer | null;
  state: AppState;
}

let deps: OrchestratorDeps | null = null;
let extractionQueue: ExtractionQueue | null = null;
let composerListener: ((ev: Event) => void) | null = null;
/**
 * Turn-level concurrency lock (T0.6 from Heart ROADMAP, post-2026-05-18
 * code review). While a turn is running (Pulse query → LLM stream),
 * subsequent `composer:send` events are dropped with a user-visible
 * system message rather than starting an overlapping turn. Overlapping
 * turns corrupt state snapshots, append assistant messages out of order,
 * and race Cartographer write-backs.
 */
let turnInProgress = false;

export function setOrchestrator(d: OrchestratorDeps): void {
  deps = d;
  // T0.8: wrap the extractor in a durable queue with retry + DLQ.
  // makeExtractor() returns null if no Anthropic key is set — in that
  // case extraction is simply disabled (queue stays null).
  const extractor = makeExtractor();
  extractionQueue = extractor
    ? new ExtractionQueue(extractor, (result) => {
        cartographer.applyExtraction(result);
      })
    : null;
  // Idempotent listener registration: remove any prior listener before
  // adding the new one. setOrchestrator can be called multiple times
  // during dev (HMR, test setup); we must not accumulate listeners.
  if (composerListener) {
    document.removeEventListener('composer:send', composerListener as EventListener);
  }
  composerListener = onComposerSend as (ev: Event) => void;
  document.addEventListener('composer:send', composerListener as EventListener);
}

async function onComposerSend(ev: Event): Promise<void> {
  if (!deps) return;
  const detail = (ev as CustomEvent<{ text: string }>).detail;
  const text = detail.text.trim();
  if (!text) return;

  // T0.6: drop overlapping turns. Surface to user so they know the input
  // was seen but not actioned; they can retry once the prior turn finishes.
  if (turnInProgress) {
    deps.state.appendSystem(
      '[предыдущий ответ ещё идёт — дождись, потом отправь]',
    );
    return;
  }
  turnInProgress = true;

  cartographer.bumpTurn();

  try {
    if (cartographer.state.mode === 'onboarding') {
      await runOnboardingTurn(text);
    } else {
      await runNormalTurn(text);
    }

    // Soft transition: once we've collected enough, leave onboarding silently.
    if (cartographer.shouldSwitchToNormal()) {
      cartographer.forceMode('normal');
    }

    // Post-turn extraction in background — never blocks UX.
    fireExtraction().catch((e) =>
      console.error('background extraction failed:', e),
    );
  } finally {
    turnInProgress = false;
  }
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

export async function onComposerSendForTest(text: string, testDeps: OrchestratorDeps): Promise<void> {
  const prev = deps;
  deps = testDeps;
  try {
    cartographer.bumpTurn();
    if (cartographer.state.mode === 'onboarding') {
      await runOnboardingTurn(text);
    } else {
      await runNormalTurn(text);
    }
    if (cartographer.shouldSwitchToNormal()) {
      cartographer.forceMode('normal');
    }
  } finally {
    deps = prev;
  }
}
export async function runNormalTurnForTest(text: string, testDeps: OrchestratorDeps): Promise<void> {
  const prev = deps;
  deps = testDeps;
  try {
    await runNormalTurn(text);
  } finally {
    deps = prev;
  }
}

async function runNormalTurn(text: string): Promise<void> {
  if (!deps) return;
  const { memory, llm, state } = deps;

  state.appendUser(text);
  // T0.7: freeze user_state at turn start. Any state mutation during
  // the async retrieval/streaming window (mood slider, Apple Health
  // tick, continuous-extractor write) does NOT alter the snapshot
  // memory backend sees.
  const userStateSnapshot = state.snapshotUserState();
  const route = routeConversation(text);
  const allowedCapabilities = allowedCapabilitiesFor(route);

  // Fire ingest in parallel; don't await
  memory.ingestTurn({ text, ts: new Date().toISOString() }).catch((e) => {
    console.error('ingest failed:', e);
  });

  pulseBurst();
  // T0.10: memory.buildContext returns null on failure rather than throwing —
  // orchestrator does NOT need its own try/catch around retrieval.
  // PulseMemoryBackend.buildContext maps PulseContextResult into a
  // MemoryContext with the full response stashed on `.raw` for the
  // context-builder (which still touches Pulse-specific fields; full
  // decoupling of context-builder is v6 work, see Heart ROADMAP T0.10).
  // Hard domain filter (excluding fiction_content / fiction_meta to keep
  // the Sonya novel out of real-life chat answers) is passed via the
  // generic MemoryContextRequest; backends that don't model fiction/real
  // are expected to ignore it.
  const memoryContext = await memory.buildContext({
    query: text,
    mode: 'auto',
    topK: 5,
    userState: userStateSnapshot.state,
    domainHints: route.domains,
    domainsAllowed: ['real', 'meta_authorial'],
    includeTrace: isDebugMode(),
  });

  const pulseContext: PulseContextResult | undefined = memoryContext
    ? (memoryContext.raw as PulseContextResult)
    : undefined;

  if (memoryContext) {
    state.appendRouterDecision(
      {
        mode: `${route.domains.join('+')} / ${memoryContext.modeUsed}`,
        confidence: route.confidence,
        classifier: memoryContext.classifier,
        reasoning: route.reasons.join('; '),
      },
      text,
    );
  } else {
    state.appendRouterDecision(
      {
        mode: `${route.domains.join('+')} / no-context`,
        confidence: route.confidence,
        classifier: 'heart:fallback',
        reasoning: route.reasons.join('; '),
      },
      text,
    );
  }

  const contextPacks = buildContextPacks({
    route,
    pulseContext,
    profile: cartographer.state.profile,
    allowedCapabilities,
  });

  if (!llm) {
    state.appendSystem(
      'Anthropic key is not set. Add it in dev settings to let Heart answer.',
    );
    return;
  }

  const assistantMsg = state.appendAssistantStart();
  try {
    await llm.stream({
      messages: state.messages.slice(0, -1),
      route,
      contextPacks,
      onChunk: (chunk) => state.appendAssistantChunk(assistantMsg.id, chunk),
      onComplete: () => {
        if (pulseContext) state.attachContextMeta(assistantMsg.id, pulseContext);
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


function isDebugMode(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1';
}

/**
 * T0.8: enqueue extraction with durable retry + DLQ instead of the prior
 * fire-and-forget that silently dropped 429s / parse fails / timeouts.
 *
 * Returns immediately after enqueue — the queue handles retry in the
 * background. Apply hook (passed to ExtractionQueue constructor) calls
 * cartographer.applyExtraction on success.
 */
async function fireExtraction(): Promise<void> {
  if (!deps || !extractionQueue) return;
  const recent = turnsFromMessages(deps.state.messages, 4);
  if (recent.length < 2) return; // need at least one user + one assistant
  extractionQueue.enqueue(
    { profile: cartographer.state.profile, recentTurns: recent },
    cartographer.state.turns_count,
  );
}
