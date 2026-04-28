/**
 * <heart-pulse> — single static ember glow in the corner.
 *
 * Element name kept for backward compatibility with index.html and CSS;
 * visual is now a quiet ember (circle + soft glow) instead of an animated
 * heart. No biometric mapping, no retrieval bursts. The corner mark is an
 * anchor that the room is open, nothing more.
 */

const SVG = `
<svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true">
  <circle cx="12" cy="12" r="4" fill="currentColor" />
</svg>`;

export class HeartPulse extends HTMLElement {
  connectedCallback(): void {
    this.innerHTML = `<span class="ember">${SVG}</span>`;
  }
}

export function pulseBurst(): void {
  // intentionally a no-op — kept so orchestrator import does not break.
}
