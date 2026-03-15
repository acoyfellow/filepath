import { describe, expect, test } from "bun:test";

import { buildProviderKeysEnvelope, PROVIDER_KEYS_UNREADABLE_MESSAGE } from "../src/lib/provider-key-state";

describe("provider key state", () => {
  test("marks missing and saved provider states explicitly", () => {
    const envelope = buildProviderKeysEnvelope({
      keys: {
        openrouter: "sk-or-v1...abcd",
        zen: null,
      },
    });

    expect(envelope.status).toBe("ready");
    expect(envelope.states.openrouter.status).toBe("saved");
    expect(envelope.states.openrouter.masked).toBe("sk-or-v1...abcd");
    expect(envelope.states.zen.status).toBe("missing");
  });

  test("surfaces unreadable stored keys as a recoverable product state", () => {
    const envelope = buildProviderKeysEnvelope({
      unreadable: true,
    });

    expect(envelope.status).toBe("unreadable");
    expect(envelope.message).toBe(PROVIDER_KEYS_UNREADABLE_MESSAGE);
    expect(envelope.states.openrouter.status).toBe("unreadable");
    expect(envelope.states.zen.status).toBe("unreadable");
  });
});
