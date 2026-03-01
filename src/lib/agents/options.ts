import type { ModelId, RouterId } from '$lib/types/session';
import { DEFAULT_MODEL } from '$lib/config';

export const MODEL_OPTIONS: { value: ModelId; label: string }[] = [
  { value: DEFAULT_MODEL as ModelId, label: 'Moonshot AI / Kimi K2.5 (default)' },
  { value: 'anthropic/claude-sonnet-4.5', label: 'Anthropic / Claude Sonnet 4.5' },
  { value: 'openai/gpt-5', label: 'OpenAI / GPT-5' },
  { value: 'openai/gpt-5-mini', label: 'OpenAI / GPT-5 mini' },
  { value: 'deepseek/deepseek-r1', label: 'DeepSeek / R1' },
  { value: 'google/gemini-2.5-pro', label: 'Google / Gemini 2.5 Pro' },
  { value: 'zen/gpt-5', label: 'OpenCode Zen / GPT-5' },
];

export const ROUTER_OPTIONS: { value: RouterId; label: string }[] = [
  { value: 'direct', label: 'Direct API' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'zen', label: 'OpenCode Zen' },
  { value: 'fireworks', label: 'Fireworks AI' },
];
