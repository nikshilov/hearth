import type { ContextPack } from '../context/context-pack.js';
import type { ConversationRoute } from '../router/domain-router.js';

export interface BuildSystemPromptArgs {
  baseSystem?: string;
  route?: ConversationRoute;
  contextPacks?: ContextPack[];
}

const DEFAULT_SYSTEM = `You are Hearth, a single companion voice with access to the user's memory via Pulse.

Use provided context to ground replies when it helps, but speak naturally. If context is insufficient, say so without turning the answer into a debug report.`;

const POLICY = `Speak as one companion. Do not ask the user to switch agents or skills. Do not expose route decisions, event ids, or shadow hypotheses. Use memories only when they help. If context is insufficient, say so naturally.`;

export function buildSystemPrompt(args: BuildSystemPromptArgs): string {
  const parts = [args.baseSystem ?? DEFAULT_SYSTEM];

  if (args.route) {
    parts.push(
      '',
      `<hearth_route domains="${args.route.domains.join(',')}" sensitivity="${args.route.sensitivity}" tool_need="${args.route.toolNeed}" confidence="${args.route.confidence.toFixed(2)}" />`,
    );
  }

  for (const pack of args.contextPacks ?? []) {
    if (pack.visibility === 'debug_only') continue;
    parts.push(
      '',
      `<context_pack name="${escapeAttr(pack.name)}" visibility="${pack.visibility}" budget_tokens="${pack.budgetTokens}">`,
      pack.content,
      '</context_pack>',
    );
  }

  parts.push('', '<policy>', POLICY, '</policy>');
  return parts.join('\n');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
