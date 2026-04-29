/**
 * hearth boot. Registers custom elements, wires the orchestrator.
 *
 * Default view: single column, no panels, no header name, no status,
 * no map. Just chat. Debug surface (profile-snapshot, state-panel,
 * router-log) appears only with ?debug=1.
 *
 * URL flags:
 *   ?reset=1       — clear cartographer profile + chat state
 *   ?onboarding=1  — force onboarding mode
 *   ?normal=1      — skip onboarding, go to companion mode
 *   ?debug=1       — show profile-snapshot, state-panel, router-log
 *   ?demo=1        — offline demo: mock Pulse + canned cartographer replies,
 *                    nothing persists, nothing leaves the page.
 *
 * Top-level await: cartographer is loaded *after* the demo-mode purge so
 * its singleton constructor never reads stale localStorage.
 */
import {
  isDemoMode,
  purgeLocalStorageForDemo,
  MockPulseClient,
  MockClaudeAdapter,
  mountDemoBadge,
} from './demo-mode.js';

const DEMO = isDemoMode();
if (DEMO) purgeLocalStorageForDemo();

const { state } = await import('./state.js');
const { makeClient } = await import('./api.js');
const { makeAdapter } = await import('./llm.js');
const { registerComponents } = await import('./components/index.js');
const { setOrchestrator } = await import('./orchestrator.js');
const { cartographer } = await import('./cartographer.js');

registerComponents();

const params = new URLSearchParams(location.search);
if (params.has('reset')) cartographer.reset();
if (params.has('onboarding')) cartographer.forceMode('onboarding');
if (params.has('normal')) cartographer.forceMode('normal');
if (params.has('debug')) document.body.classList.add('debug-mode');

// Demo flow goes through normal mode by default — we want the GIF to show
// retrieval landing on fixture memories, not the empty onboarding screen.
// Override only if the URL explicitly forces ?onboarding=1.
if (DEMO && !params.has('onboarding')) cartographer.forceMode('normal');

const pulse = DEMO ? new MockPulseClient() : makeClient();
const llm = DEMO ? new MockClaudeAdapter() : makeAdapter();
if (DEMO) mountDemoBadge();

setOrchestrator({ pulse, llm, state });

if (!llm) {
  state.appendSystem(
    'no anthropic key. set localStorage["anthropic:key"] in devtools and reload.',
  );
}

(window as unknown as { __hearth: unknown }).__hearth = {
  pulse, llm, state, cartographer, demo: DEMO,
};
