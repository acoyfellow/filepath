import { json, error } from "@sveltejs/kit";
import type { RequestEvent, RequestHandler, ServerLoadEvent } from "@sveltejs/kit";
import { getDrizzle } from "$lib/auth";
import { user } from "$lib/schema";
import { decryptApiKey } from "$lib/crypto";
import { PROVIDERS, prefixModelForProvider, type ProviderId } from "$lib/provider-keys";
import { deserializeStoredProviderKeys } from "$lib/provider-keys";
import { eq } from "drizzle-orm";

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

const cachedCatalogs = new Map<string, { payload: CachedCatalog; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getBetterAuthSecret(platform: ServerLoadEvent["platform"]): string | undefined {
  const secret =
    platform?.env && "BETTER_AUTH_SECRET" in platform.env
      ? platform.env.BETTER_AUTH_SECRET
      : undefined;
  return typeof secret === "string" ? secret : undefined;
}

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
  if (!_event.locals.user) throw error(401, "Unauthorized");

  const db = getDrizzle();
  const rows = await db
    .select({ openrouterApiKey: user.openrouterApiKey })
    .from(user)
    .where(eq(user.id, _event.locals.user.id))
    .limit(1);

  const encryptedKeys = rows[0]?.openrouterApiKey;
  const secret = getBetterAuthSecret(_event.platform);
  let enabledRouters: ProviderId[] = [];

  if (encryptedKeys && secret) {
    try {
      const decrypted = await decryptApiKey(encryptedKeys, secret);
      const providerKeys = deserializeStoredProviderKeys(decrypted);
      enabledRouters = (Object.entries(providerKeys) as Array<[ProviderId, string | undefined]>)
        .filter(([, value]) => Boolean(value))
        .map(([provider]) => provider);
    } catch {
      return json({
        models: [],
        warnings: ["Stored provider keys are unreadable. Re-save them in Settings / Account."],
      });
    }
  }

  if (enabledRouters.length === 0) {
    return json({
      models: [],
      warnings: ["No router keys configured. Add a provider key in Settings / Account."],
    });
  }

  const cacheKey = enabledRouters.slice().sort().join(",");
  const now = Date.now();

  const cached = cachedCatalogs.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return json(cached.payload);
  }

  const models: ModelEntry[] = [];
  const warnings: string[] = [];
  if (enabledRouters.includes("openrouter")) {
    const openRouterResult = await Promise.allSettled([fetchOpenRouterModels()]);
    if (openRouterResult[0].status === "fulfilled") {
      models.push(...openRouterResult[0].value);
    } else {
      console.error("Failed to load models from OpenRouter:", openRouterResult[0].reason);
      warnings.push("OpenRouter model catalog unavailable");
    }
  }
  if (enabledRouters.includes("zen")) {
    const zenResult = await Promise.allSettled([fetchZenModels()]);
    if (zenResult[0].status === "fulfilled") {
      models.push(...zenResult[0].value);
    } else {
      console.error("Failed to load models from OpenCode Zen:", zenResult[0].reason);
      warnings.push("OpenCode Zen model catalog unavailable");
    }
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

  cachedCatalogs.set(cacheKey, { payload, timestamp: now });
  return json(payload);
};
