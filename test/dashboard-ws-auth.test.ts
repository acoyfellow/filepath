import { describe, expect, test } from "bun:test";

import {
  createDashboardWsToken,
  verifyDashboardWsToken,
} from "../src/lib/dashboard-ws-auth";

describe("dashboard websocket auth tokens", () => {
  test("round-trips valid claims", async () => {
    const token = await createDashboardWsToken(
      {
        userId: "user_123",
        sessionId: "session_456",
      },
      "secret",
      60_000,
    );

    const claims = await verifyDashboardWsToken(token, "secret");

    expect(claims).not.toBeNull();
    expect(claims).toMatchObject({
      userId: "user_123",
      sessionId: "session_456",
      v: 1,
    });
  });

  test("rejects expired tokens", async () => {
    const token = await createDashboardWsToken(
      {
        userId: "user_123",
        sessionId: "session_456",
      },
      "secret",
      -1,
    );

    const claims = await verifyDashboardWsToken(token, "secret");

    expect(claims).toBeNull();
  });

  test("rejects tampered tokens", async () => {
    const token = await createDashboardWsToken(
      {
        userId: "user_123",
        sessionId: "session_456",
      },
      "secret",
      60_000,
    );

    const [payload, signature] = token.split(".");
    const lastChar = payload.at(-1) ?? "A";
    const replacement = lastChar === "A" ? "B" : "A";
    const tamperedPayload = `${payload.slice(0, -1)}${replacement}`;
    const claims = await verifyDashboardWsToken(`${tamperedPayload}.${signature}`, "secret");

    expect(claims).toBeNull();
  });
});
