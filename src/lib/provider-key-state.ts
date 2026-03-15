import { PROVIDER_IDS, PROVIDERS, type ProviderId } from "$lib/provider-keys";

export type ProviderKeyStateStatus = "saved" | "missing" | "unreadable";
export type ProviderKeysOverallStatus = "ready" | "missing" | "unreadable";

export interface ProviderKeyState {
  provider: ProviderId;
  label: string;
  status: ProviderKeyStateStatus;
  masked: string | null;
  message: string;
}

export interface ProviderKeysEnvelope {
  status: ProviderKeysOverallStatus;
  message: string | null;
  keys: Record<ProviderId, string | null>;
  states: Record<ProviderId, ProviderKeyState>;
}

export const PROVIDER_KEYS_UNREADABLE_MESSAGE =
  "Stored model provider keys are unreadable. Clear or re-save them in Settings -> Account.";

function coerceMaskedKeys(
  keys: Partial<Record<ProviderId, string | null>> | undefined,
): Record<ProviderId, string | null> {
  return {
    openrouter: keys?.openrouter ?? null,
    zen: keys?.zen ?? null,
  };
}

export function buildProviderKeysEnvelope(input: {
  keys?: Partial<Record<ProviderId, string | null>>;
  unreadable?: boolean;
  message?: string | null;
}): ProviderKeysEnvelope {
  const keys = coerceMaskedKeys(input.keys);

  if (input.unreadable) {
    return {
      status: "unreadable",
      message: input.message ?? PROVIDER_KEYS_UNREADABLE_MESSAGE,
      keys,
      states: Object.fromEntries(
        PROVIDER_IDS.map((provider) => [
          provider,
          {
            provider,
            label: PROVIDERS[provider].label,
            status: "unreadable",
            masked: null,
            message: PROVIDER_KEYS_UNREADABLE_MESSAGE,
          } satisfies ProviderKeyState,
        ]),
      ) as Record<ProviderId, ProviderKeyState>,
    };
  }

  const states = Object.fromEntries(
    PROVIDER_IDS.map((provider) => {
      const masked = keys[provider] ?? null;
      const label = PROVIDERS[provider].label;
      const status: ProviderKeyStateStatus = masked ? "saved" : "missing";
      return [
        provider,
        {
          provider,
          label,
          status,
          masked,
          message: masked ? `${label} is ready for live runs.` : `No ${label} key saved yet.`,
        } satisfies ProviderKeyState,
      ];
    }),
  ) as Record<ProviderId, ProviderKeyState>;

  const hasSavedKey = PROVIDER_IDS.some((provider) => Boolean(keys[provider]));

  return {
    status: hasSavedKey ? "ready" : "missing",
    message: input.message ?? null,
    keys,
    states,
  };
}
