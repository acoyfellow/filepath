export const PROVIDER_IDS = ["openrouter", "zen"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ProviderKeyMap = Partial<Record<ProviderId, string>>;

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  docsUrl: string;
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

export async function validateProviderApiKey(provider: ProviderId, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (trimmed.length < 10) {
    throw new Error("API key too short");
  }

  const definition = PROVIDERS[provider];
  let response: Response;
  try {
    response = await fetch(definition.validateUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        ...definition.defaultHeaders,
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error(`${definition.label} validation request failed`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = body.trim().slice(0, 160);
    throw new Error(
      detail
        ? `${definition.label} rejected this key (${response.status}): ${detail}`
        : `${definition.label} rejected this key (${response.status})`
    );
  }
}
