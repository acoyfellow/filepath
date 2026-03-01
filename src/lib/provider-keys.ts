export const PROVIDER_IDS = ["openrouter", "zen"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ProviderKeyMap = Partial<Record<ProviderId, string>>;

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  docsUrl: string;
  modelsUrl: string;
  keyPlaceholder: string;
  helpText: string;
  envKey: string;
  apiUrl: string;
  validateUrl: string;
  defaultHeaders?: Record<string, string>;
}

export const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    docsUrl: "https://openrouter.ai/keys",
    modelsUrl: "https://openrouter.ai/api/v1/models",
    keyPlaceholder: "sk-or-v1-...",
    helpText: "Access many upstream models through one key.",
    envKey: "OPENROUTER_API_KEY",
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    validateUrl: "https://openrouter.ai/api/v1/auth/key",
    defaultHeaders: {
      "HTTP-Referer": "https://myfilepath.com",
      "X-Title": "filepath",
    },
  },
  zen: {
    id: "zen",
    label: "OpenCode Zen",
    docsUrl: "https://opencode.ai/zen",
    modelsUrl: "https://opencode.ai/zen/v1/models",
    keyPlaceholder: "sk-...",
    helpText: "Route requests through OpenCode's hosted router.",
    envKey: "OPENCODE_ZEN_API_KEY",
    apiUrl: "https://opencode.ai/api/v1/chat/completions",
    validateUrl: "https://opencode.ai/zen/v1/models",
  },
};

export function isProviderId(value: string): value is ProviderId {
  return PROVIDER_IDS.includes(value as ProviderId);
}

export function maskProviderKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return "****";
  }
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function deserializeStoredProviderKeys(raw: string): ProviderKeyMap {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { openrouter: trimmed };
    }

    const result: ProviderKeyMap = {};
    for (const provider of PROVIDER_IDS) {
      const value = parsed[provider];
      if (typeof value === "string" && value.trim()) {
        result[provider] = value.trim();
      }
    }
    return result;
  } catch {
    return { openrouter: trimmed };
  }
}

export function serializeStoredProviderKeys(keys: ProviderKeyMap): string | null {
  const normalized: ProviderKeyMap = {};
  for (const provider of PROVIDER_IDS) {
    const value = keys[provider]?.trim();
    if (value) {
      normalized[provider] = value;
    }
  }

  if (Object.keys(normalized).length === 0) {
    return null;
  }

  return JSON.stringify(normalized);
}

export function maskProviderKeys(keys: ProviderKeyMap): Record<ProviderId, string | null> {
  return {
    openrouter: keys.openrouter ? maskProviderKey(keys.openrouter) : null,
    zen: keys.zen ? maskProviderKey(keys.zen) : null,
  };
}

export function getProviderForModel(model: string): ProviderId {
  return model.startsWith("zen/") ? "zen" : "openrouter";
}

export function normalizeModelForProvider(model: string): string {
  if (model.startsWith("zen/")) {
    return model.slice("zen/".length);
  }
  if (model.startsWith("openrouter/")) {
    return model.slice("openrouter/".length);
  }
  return model;
}

export function prefixModelForProvider(provider: ProviderId, model: string): string {
  return provider === "zen" ? `zen/${model}` : model;
}

const LEGACY_OPENROUTER_MODEL_ALIASES: Record<string, string> = {
  "kimi-k2.5": "moonshotai/kimi-k2.5",
  "claude-sonnet-4": "anthropic/claude-sonnet-4",
  "claude-opus-4-1": "anthropic/claude-opus-4.1",
  "claude-sonnet-4-5": "anthropic/claude-sonnet-4.5",
  "gpt-4o": "openai/gpt-4o",
  "o3": "openai/o3",
  "o3-mini": "openai/o3-mini",
  "gpt-5": "openai/gpt-5",
  "gpt-5-mini": "openai/gpt-5-mini",
  "deepseek-r1": "deepseek/deepseek-r1",
  "gemini-2.5-pro": "google/gemini-2.5-pro",
  "gemini-2.5-flash": "google/gemini-2.5-flash",
};

const LEGACY_ZEN_MODEL_ALIASES: Record<string, string> = {
  "anthropic/claude-sonnet-4": "claude-sonnet-4",
  "anthropic/claude-opus-4.1": "claude-opus-4-1",
  "anthropic/claude-sonnet-4.5": "claude-sonnet-4-5",
  "openai/gpt-4o": "gpt-4o",
  "openai/o3": "o3",
  "openai/o3-mini": "o3-mini",
  "openai/gpt-5": "gpt-5",
  "openai/gpt-5-mini": "gpt-5-mini",
  "deepseek/deepseek-r1": "deepseek-r1",
  "google/gemini-2.5-pro": "gemini-2.5-pro",
  "google/gemini-2.5-flash": "gemini-2.5-flash",
};

export function canonicalizeStoredModel(model: string): string {
  if (model.startsWith("zen/")) {
    const normalized = normalizeModelForProvider(model);
    const zenModel = LEGACY_ZEN_MODEL_ALIASES[normalized] ?? normalized;
    return `zen/${zenModel}`;
  }

  const normalized = normalizeModelForProvider(model);
  return LEGACY_OPENROUTER_MODEL_ALIASES[normalized] ?? normalized;
}

export async function validateProviderApiKey(provider: ProviderId, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (trimmed.length < 10) {
    throw new Error("API key too short");
  }

  const definition = PROVIDERS[provider];
  const validateOnce = async (headers: Headers): Promise<Response> =>
    fetch(definition.validateUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(5000),
    });

  const primaryHeaders = new Headers();
  primaryHeaders.set("Authorization", `Bearer ${trimmed}`);

  // OpenRouter validation is sensitive here in dev; skip optional attribution headers.
  if (provider !== "openrouter" && definition.defaultHeaders) {
    for (const [key, value] of Object.entries(definition.defaultHeaders)) {
      primaryHeaders.set(key, value);
    }
  }

  let response: Response;
  let body = "";
  try {
    response = await validateOnce(primaryHeaders);
    body = await response.text().catch(() => "");
  } catch {
    throw new Error(`${definition.label} validation request failed`);
  }

  if (!response.ok && provider === "openrouter" && body.includes("Missing Authentication header")) {
    try {
      const retryHeaders = new Headers();
      retryHeaders.set("authorization", `Bearer ${trimmed}`);
      response = await validateOnce(retryHeaders);
      body = await response.text().catch(() => "");
    } catch {
      throw new Error(`${definition.label} validation request failed`);
    }
  }

  if (!response.ok) {
    const detail = body.trim().slice(0, 160);
    throw new Error(
      detail
        ? `${definition.label} rejected this key (${response.status}): ${detail}`
        : `${definition.label} rejected this key (${response.status})`
    );
  }
}
