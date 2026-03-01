import { json } from "@sveltejs/kit";
import type { RequestEvent, RequestHandler } from "@sveltejs/kit";
import { PROVIDERS, prefixModelForProvider, type ProviderId } from "$lib/provider-keys";

interface OpenRouterModel {
  id: string;
  name: string;
  context_length?: number;
}

interface ZenModel {
  id: string;
}

interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  router: ProviderId;
  contextLength?: number;
}

interface CachedCatalog {
  models: ModelEntry[];
  warnings?: string[];
}

let cachedCatalog: CachedCatalog | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function inferProvider(modelId: string): string {
  const normalized = modelId.toLowerCase();

  if (normalized.includes("/")) {
    const prefix = normalized.split("/", 1)[0];
    const providers: Record<string, string> = {
      anthropic: "Anthropic",
      openai: "OpenAI",
      google: "Google",
      deepseek: "DeepSeek",
      meta: "Meta",
      mistralai: "Mistral",
      cohere: "Cohere",
      qwen: "Qwen",
      moonshotai: "Moonshot AI",
      moonshot: "Moonshot AI",
    };
    return providers[prefix] ?? prefix;
  }

  if (normalized.startsWith("claude")) return "Anthropic";
  if (normalized.startsWith("gpt") || normalized.startsWith("o3") || normalized.startsWith("o4")) return "OpenAI";
  if (normalized.startsWith("gemini")) return "Google";
  if (normalized.startsWith("deepseek")) return "DeepSeek";
  if (normalized.startsWith("qwen")) return "Qwen";
  if (normalized.startsWith("kimi")) return "Moonshot AI";
  if (normalized.startsWith("llama")) return "Meta";

  return "Other";
}

function humanizeModelId(modelId: string): string {
  return modelId
    .split(/[/:_-]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^[0-9.]+$/.test(part)) return part;
      if (part.length <= 3) return part.toUpperCase();
      return part[0].toUpperCase() + part.slice(1);
    })
    .join(" ");
}

async function fetchOpenRouterModels(): Promise<ModelEntry[]> {
  const response = await fetch(PROVIDERS.openrouter.modelsUrl, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter returned ${response.status}`);
  }

  const data = (await response.json()) as { data?: OpenRouterModel[] };

  return (data.data ?? [])
    .filter((model) => model.id && model.name)
    .map((model) => ({
      id: model.id,
      name: model.name,
      provider: inferProvider(model.id),
      router: "openrouter" as const,
      contextLength: model.context_length,
    }));
}

async function fetchZenModels(): Promise<ModelEntry[]> {
  const response = await fetch(PROVIDERS.zen.modelsUrl, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`OpenCode Zen returned ${response.status}`);
  }

  const data = (await response.json()) as { data?: ZenModel[] };

  return (data.data ?? [])
    .filter((model) => model.id)
    .map((model) => ({
      id: prefixModelForProvider("zen", model.id),
      name: `OpenCode Zen / ${humanizeModelId(model.id)}`,
      provider: inferProvider(model.id),
      router: "zen" as const,
    }));
}

export const GET: RequestHandler = async (_event: RequestEvent) => {
  const now = Date.now();

  if (cachedCatalog && now - cacheTimestamp < CACHE_TTL) {
    return json(cachedCatalog);
  }

  const [openRouterResult, zenResult] = await Promise.allSettled([
    fetchOpenRouterModels(),
    fetchZenModels(),
  ]);

  const models: ModelEntry[] = [];
  const warnings: string[] = [];

  if (openRouterResult.status === "fulfilled") {
    models.push(...openRouterResult.value);
  } else {
    console.error("Failed to load models from OpenRouter:", openRouterResult.reason);
    warnings.push("OpenRouter model catalog unavailable");
  }

  if (zenResult.status === "fulfilled") {
    models.push(...zenResult.value);
  } else {
    console.error("Failed to load models from OpenCode Zen:", zenResult.reason);
    warnings.push("OpenCode Zen model catalog unavailable");
  }

  const dedupedModels = Array.from(
    new Map(models.map((model) => [model.id, model])).values(),
  ).sort((a, b) => a.id.localeCompare(b.id));

  if (dedupedModels.length === 0) {
    return json(
      {
        error: "Model catalog unavailable",
        warnings,
      },
      { status: 503 },
    );
  }

  const payload: CachedCatalog = {
    models: dedupedModels,
    ...(warnings.length > 0 ? { warnings } : {}),
  };

  cachedCatalog = payload;
  cacheTimestamp = now;

  return json(payload);
};
