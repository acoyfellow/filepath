import type { ModelId, RouterId } from '$lib/types/session';
import { DEFAULT_MODEL } from '$lib/config';

export const MODEL_OPTIONS: { value: ModelId; label: string }[] = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4' },
  { value: DEFAULT_MODEL as ModelId, label: 'Default Model' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'o3', label: 'o3' },
  { value: 'deepseek-r1', label: 'DeepSeek R1' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

export const ROUTER_OPTIONS: { value: RouterId; label: string }[] = [
  { value: 'direct', label: 'Direct API' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'fireworks', label: 'Fireworks AI' },
];
