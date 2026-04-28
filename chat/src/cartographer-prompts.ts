/**
 * Cartographer prompts loaded at build-time from sibling cartographer/ folder.
 * esbuild's --loader:.md=text inlines the markdown as a string.
 *
 * If you edit a prompt, edit the .md file in cartographer/prompts/, never copy
 * here. These are the canonical artifacts.
 */
// @ts-expect-error — esbuild loader stub. ts-loader treats .md as text.
import onboardingRu from '../../cartographer/prompts/onboarding_ru.md';
// @ts-expect-error — same as above.
import continuousPrompt from '../../cartographer/prompts/continuous.md';

export const ONBOARDING_PROMPT_RU: string = onboardingRu as string;
export const CONTINUOUS_PROMPT: string = continuousPrompt as string;
