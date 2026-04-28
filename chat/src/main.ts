/**
 * hearth boot. Registers custom elements, wires the orchestrator.
 *
 * URL flags (dev convenience):
 *   ?reset=1       — clear cartographer profile + chat state
 *   ?onboarding=1  — force onboarding mode (even on a saved profile)
 *   ?normal=1      — skip onboarding, go straight to companion mode
 *
 * Anti-MF0 rule: this file caps at ~80 lines.
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

const pulse = makeClient();
const llm = makeAdapter();

setOrchestrator({ pulse, llm, state });

const tagEl = document.querySelector<HTMLElement>('[data-mode-tag]');
function paintModeTag(): void {
  if (!tagEl) return;
  tagEl.textContent = cartographer.state.mode === 'onboarding' ? 'картограф' : 'дом';
}
paintModeTag();
cartographer.addEventListener('modeChanged', paintModeTag);
cartographer.addEventListener('reset', paintModeTag);

if (cartographer.state.mode === 'onboarding' && cartographer.state.turns_count === 0) {
  state.appendSystem(
    'привет. начнётся картограф — ~30 минут разговора чтобы построить твою карту. напиши что-нибудь чтобы начать.',
  );
}

if (!llm) {
  state.appendSystem(
    'no anthropic key. set localStorage["anthropic:key"] in devtools and reload — без неё ни картограф ни компаньон не говорят.',
  );
}

(window as unknown as { __hearth: unknown }).__hearth = {
  pulse, llm, state, cartographer,
};
