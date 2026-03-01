import type { ModelId, RouterId } from '$lib/types/session';
import { DEFAULT_MODEL } from '$lib/config';

export const MODEL_OPTIONS: { value: ModelId; label: string }[] = [
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { value: DEFAULT_MODEL as ModelId, label: 'Default Model' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-5-mini', label: 'GPT-5 mini' },
  { value: 'deepseek-r1', label: 'DeepSeek R1' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'zen/openai/gpt-5', label: 'OpenCode Zen / GPT-5' },
];

export const ROUTER_OPTIONS: { value: RouterId; label: string }[] = [
  { value: 'direct', label: 'Direct API' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'zen', label: 'OpenCode Zen' },
  { value: 'fireworks', label: 'Fireworks AI' },
];
