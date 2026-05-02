import type { RetrieveResponse } from '../api.js';
import type { ConversationRoute } from '../router/domain-router.js';
import type { Capability } from '../tools/capability-registry.js';
import type { ContextPack } from './context-pack.js';

export interface BuildContextPacksArgs {
  route: ConversationRoute;
  retrieval?: RetrieveResponse;
  retrievedTexts?: Map<number, string>;
  profile?: unknown;
  allowedCapabilities: Capability[];
}

export function buildContextPacks(args: BuildContextPacksArgs): ContextPack[] {
  const packs: ContextPack[] = [buildRoutePack(args.route, args.allowedCapabilities)];

  if (args.retrieval && hasLoadedMemoryText(args.retrieval, args.retrievedTexts)) {
    packs.push(buildPulsePack(args.retrieval, args.retrievedTexts));
  }

  const profilePack = buildCartographerPack(args.profile);
  if (profilePack) packs.push(profilePack);

  if (args.route.domains.includes('book')) {
    packs.push(domainHintPack('book_pack', 'Book/Sonya domain is active. Use book context only when the user is actually working with fiction, chapters, scenes, or Sonya.'));
  }
  if (args.route.domains.includes('mila')) {
    packs.push(domainHintPack('mila_pack', 'Mila domain is active. Treat Mila as Nikita\'s AI influencer project, not as generic social media work.'));
  }
  if (args.route.domains.includes('zasluzhivatel')) {
    packs.push(domainHintPack('parts_pack', 'Zasluzhivatel domain is active. Do not turn resistance into productivity; name the part and work with Nikita, not through it.'));
  }
  if (args.allowedCapabilities.some((capability) => capability.name === 'health.summary')) {
    packs.push(domainHintPack('body_pack', 'health.summary is allowed for this turn. Pull or use body context only as read-only grounding.'));
  }
  if (args.route.domains.includes('tasks')) {
    packs.push(domainHintPack('task_pack', 'Tasks domain is active. Prefer remembered commitments before external reads unless the user asks for calendar or mail.'));
  }

  return packs;
}

function buildRoutePack(route: ConversationRoute, allowedCapabilities: Capability[]): ContextPack {
  return {
    name: 'route_pack',
    visibility: 'debug_only',
    budgetTokens: 200,
    sources: ['domain-router', 'tool-policy'],
    content: JSON.stringify(
      {
        domains: route.domains,
        sensitivity: route.sensitivity,
        toolNeed: route.toolNeed,
        confidence: route.confidence,
        allowedCapabilities: allowedCapabilities.map((capability) => capability.name),
      },
      null,
      2,
    ),
  };
}

function hasLoadedMemoryText(retrieval: RetrieveResponse, texts: Map<number, string> | undefined): boolean {
  return retrieval.event_ids.length === 0 || retrieval.event_ids.some((id) => texts?.has(id));
}

function buildPulsePack(retrieval: RetrieveResponse, texts: Map<number, string> | undefined): ContextPack {
  const lines = retrieval.event_ids.length
    ? retrieval.event_ids.map((id) => `[memory] ${texts?.get(id) ?? ''}`)
    : ['(no memories matched)'];

  return {
    name: 'pulse_memories',
    visibility: 'visible_to_model',
    budgetTokens: 900,
    sources: ['pulse.recall'],
    content: [
      `mode=${retrieval.mode_used}; classifier=${retrieval.classifier}; confidence=${retrieval.confidence.toFixed(2)}`,
      ...lines,
    ].join('\n'),
  };
}

function buildCartographerPack(profile: unknown): ContextPack | null {
  if (!profile || typeof profile !== 'object') return null;
  const sanitized = removeShadowMaterial(profile);
  return {
    name: 'cartographer_profile',
    visibility: 'hidden_steering',
    budgetTokens: 700,
    sources: ['cartographer.profile'],
    content: JSON.stringify(sanitized, null, 2),
  };
}

function domainHintPack(name: string, content: string): ContextPack {
  return {
    name,
    visibility: 'hidden_steering',
    budgetTokens: 180,
    sources: ['domain-router'],
    content,
  };
}

function removeShadowMaterial(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeShadowMaterial);
  if (!value || typeof value !== 'object') return value;

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'shadow_material') continue;
    result[key] = removeShadowMaterial(child);
  }
  return result;
}
