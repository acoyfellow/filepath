import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET /api/models
 *
 * Returns available models from OpenRouter API, cached for 1 hour.
 * Used by the spawn modal's searchable model dropdown.
 */

interface OpenRouterModel {
  id: string;
  name: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  context_length?: number;
  top_provider?: {
    max_completion_tokens?: number;
  };
}

interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  contextLength?: number;
}

let cachedModels: ModelEntry[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Curated fallback list if OpenRouter API is unreachable
const FALLBACK_MODELS: ModelEntry[] = [
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic" },
  { id: "anthropic/claude-opus-4", name: "Claude Opus 4", provider: "Anthropic" },
  { id: "anthropic/claude-haiku-4", name: "Claude Haiku 4", provider: "Anthropic" },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "openai/o3", name: "o3", provider: "OpenAI" },
  { id: "openai/o3-mini", name: "o3-mini", provider: "OpenAI" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google" },
];

function extractProvider(modelId: string): string {
  const slash = modelId.indexOf("/");
  if (slash === -1) return "Other";
  const prefix = modelId.slice(0, slash);
  const providers: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    deepseek: "DeepSeek",
    meta: "Meta",
    mistralai: "Mistral",
    cohere: "Cohere",
    qwen: "Qwen",
  };
  return providers[prefix] ?? prefix;
}

export const GET: RequestHandler = async ({ url }) => {
  const now = Date.now();

  // Return cache if fresh
  if (cachedModels && now - cacheTimestamp < CACHE_TTL) {
    return json({ models: cachedModels });
  }

  try {
    const resp = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      throw new Error(`OpenRouter returned ${resp.status}`);
    }

    const data = (await resp.json()) as { data: OpenRouterModel[] };

    const models: ModelEntry[] = data.data
      .filter((m) => m.id && m.name)
      .map((m) => ({
        id: m.id,
        name: m.name,
        provider: extractProvider(m.id),
        contextLength: m.context_length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    cachedModels = models;
    cacheTimestamp = now;

    return json({ models });
  } catch {
    // Return fallback on any error
    return json({ models: cachedModels ?? FALLBACK_MODELS });
  }
};
