/**
 * Hearth identity selector — runtime switch between voices.
 *
 * Read at each turn from localStorage["hearth:identity"]:
 *   - "elle"    → personal Elle voice (Nik's own harness).
 *   - anything else / missing → generic "default" Hearth companion
 *     (multi-person ready, no personal context baked in).
 *
 * This is a runtime read so users can flip identity in DevTools without
 * a rebuild. It is NOT an env var on purpose — env would require a build
 * boundary we do not want for a per-browser personal choice.
 */
export type HearthIdentity = 'elle' | 'default';

export function getIdentity(): HearthIdentity {
  if (typeof localStorage === 'undefined') return 'default';
  try {
    const v = localStorage.getItem('hearth:identity');
    return v === 'elle' ? 'elle' : 'default';
  } catch {
    return 'default';
  }
}
