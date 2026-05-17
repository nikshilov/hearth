/**
 * Heart identity selector — runtime switch between voices.
 *
 * Read at each turn from localStorage["heart:identity"]:
 *   - "elle"    → personal Elle voice (Nik's own harness).
 *   - anything else / missing → generic "default" Heart companion
 *     (multi-person ready, no personal context baked in).
 *
 * This is a runtime read so users can flip identity in DevTools without
 * a rebuild. It is NOT an env var on purpose — env would require a build
 * boundary we do not want for a per-browser personal choice.
 */
export type HeartIdentity = 'elle' | 'default';

export function getIdentity(): HeartIdentity {
  if (typeof localStorage === 'undefined') return 'default';
  try {
    const v = localStorage.getItem('heart:identity');
    return v === 'elle' ? 'elle' : 'default';
  } catch {
    return 'default';
  }
}
