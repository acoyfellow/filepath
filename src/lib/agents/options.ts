import type { ModelId, RouterId } from '$lib/types/session';

export const MODEL_OPTIONS: { value: ModelId; label: string }[] = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4' },
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
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
