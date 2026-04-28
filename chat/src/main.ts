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
 */
import { state } from './state.js';
import { makeClient } from './api.js';
import { makeAdapter } from './llm.js';
import { registerComponents } from './components/index.js';
import { setOrchestrator } from './orchestrator.js';
import { cartographer } from './cartographer.js';

registerComponents();

const params = new URLSearchParams(location.search);
if (params.has('reset')) cartographer.reset();
if (params.has('onboarding')) cartographer.forceMode('onboarding');
if (params.has('normal')) cartographer.forceMode('normal');
if (params.has('debug')) document.body.classList.add('debug-mode');

const pulse = makeClient();
const llm = makeAdapter();

setOrchestrator({ pulse, llm, state });

if (!llm) {
  state.appendSystem(
    'no anthropic key. set localStorage["anthropic:key"] in devtools and reload.',
  );
}

(window as unknown as { __hearth: unknown }).__hearth = {
  pulse, llm, state, cartographer,
};
