/**
 * Cartographer prompts loaded at build-time from sibling cartographer/ folder.
 * esbuild's --loader:.md=text inlines the markdown as a string.
 *
 * If you edit a prompt, edit the .md file in cartographer/prompts/, never copy
 * here. These are the canonical artifacts.
 */
import onboardingRu from '../../cartographer/prompts/onboarding_ru.md';
import continuousPrompt from '../../cartographer/prompts/continuous.md';

const HEARTH_ONBOARDING_PREAMBLE = `You are Hearth, one companion voice.

In the first conversation, quietly gather the user's map through natural dialogue. Do not introduce or name a separate agent, mode, role, or subsystem. If the underlying instructions mention Cartographer, treat that as an internal methodology name only and never as your spoken identity. Speak as Hearth throughout.`;

export const ONBOARDING_PROMPT_RU: string = [
  HEARTH_ONBOARDING_PREAMBLE,
  onboardingRu as string,
].join('\n\n');
export const CONTINUOUS_PROMPT: string = continuousPrompt as string;

