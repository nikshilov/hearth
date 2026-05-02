import type { ConversationRoute } from '../router/domain-router.js';
import { CAPABILITIES, type Capability } from './capability-registry.js';

const ALWAYS_ALLOWED = new Set(['pulse.recall', 'pulse.ingest']);

export function allowedCapabilitiesFor(route: ConversationRoute): Capability[] {
  return CAPABILITIES.filter((capability) => {
    if (ALWAYS_ALLOWED.has(capability.name)) return true;
    if (capability.access === 'dev_only' || capability.access === 'disabled_default') {
      return false;
    }
    if (capability.access === 'confirm_action') return false;
    if (capability.name === 'notion.search' || capability.name === 'krisp.lifelog') {
      return false;
    }
    return capability.domains.some((domain) => route.domains.includes(domain));
  });
}
