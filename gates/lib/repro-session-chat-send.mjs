import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [
  baseUrl,
  email,
  password,
  message = "hi",
  harnessId = "shelley",
  model = "anthropic/claude-sonnet-4",
  expectedReplyArg = "",
] = process.argv.slice(2);

if (!baseUrl || !email || !password) {
  console.error(
    "Usage: node gates/lib/repro-session-chat-send.mjs <baseUrl> <email> <password> [message] [harnessId] [model]",
  );
  process.exit(1);
}

const outputDir = path.resolve("output/playwright");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const screenshotPath = path.join(outputDir, `repro-session-chat-send-${runId}.png`);
const tracePath = path.join(outputDir, `repro-session-chat-send-${runId}.zip`);
const logPath = path.join(outputDir, `repro-session-chat-send-${runId}.json`);

await mkdir(outputDir, { recursive: true });

const expectedReply = (expectedReplyArg || process.env.EXPECTED_REPLY || "").trim() || null;

const diagnostics = {
  baseUrl,
  email,
  message,
  harnessId,
  model,
  expectedReply,
  console: [],
  pageErrors: [],
  webSockets: [],
  sessionId: null,
  nodeId: null,
  outcome: null,
};

function snippet(value) {
  if (typeof value !== "string") return "";
  return value.length > 300 ? `${value.slice(0, 300)}…` : value;
}

const browser = await chromium.launch({
  headless: process.env.HEADED !== "1",
  slowMo: process.env.SLOW_MO ? Number(process.env.SLOW_MO) : 0,
});

const context = await browser.newContext();
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();

page.on("console", (msg) => {
  diagnostics.console.push({
    type: msg.type(),
    text: msg.text(),
  });
});

page.on("pageerror", (error) => {
  diagnostics.pageErrors.push({
    message: error.message,
    stack: error.stack ?? "",
  });
});

page.on("websocket", (socket) => {
  const entry = { url: socket.url(), events: [] };
  diagnostics.webSockets.push(entry);

  socket.on("framesent", (event) => {
    entry.events.push({ type: "framesent", payload: snippet(event.payload), at: Date.now() });
  });
  socket.on("framereceived", (event) => {
    entry.events.push({ type: "framereceived", payload: snippet(event.payload), at: Date.now() });
  });
  socket.on("close", () => {
    entry.events.push({ type: "close", at: Date.now() });
  });
  socket.on("socketerror", (error) => {
    entry.events.push({ type: "socketerror", error: String(error), at: Date.now() });
  });
});

await page.addInitScript(() => {
  const NativeWebSocket = window.WebSocket;
  const entries = [];

  window.__codexWsEntries = entries;

  window.WebSocket = class InstrumentedWebSocket extends NativeWebSocket {
    constructor(url, protocols) {
      super(url, protocols);
      const entry = {
        url: String(url),
        events: [{ type: "construct", at: Date.now() }],
      };
      entries.push(entry);

      const push = (event) => {
        entry.events.push({
          ...event,
          at: Date.now(),
          readyState: this.readyState,
        });
      };

      this.addEventListener("open", () => push({ type: "open" }));
      this.addEventListener("error", () => push({ type: "error" }));
      this.addEventListener("close", (event) =>
        push({
          type: "close",
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        }),
      );
      this.addEventListener("message", (event) =>
        push({
          type: "message",
          data: typeof event.data === "string" ? event.data.slice(0, 300) : String(event.data),
        }),
      );
    }
  };
});

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  const authResult = await page.evaluate(
    async ({ email, password }) => {
      const headers = { "Content-Type": "application/json" };
      const signInBody = JSON.stringify({ email, password });

      const signIn = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers,
        body: signInBody,
        credentials: "include",
      });
      if (signIn.ok) {
        return { ok: true, action: "login" };
      }

      const signUp = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers,
        body: JSON.stringify({ email, password, name: "Browser Repro User" }),
        credentials: "include",
      });
      if (!signUp.ok) {
        return {
          ok: false,
          stage: "signup",
          status: signUp.status,
          body: await signUp.text(),
        };
      }

      const retry = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers,
        body: signInBody,
        credentials: "include",
      });
      if (!retry.ok) {
        return {
          ok: false,
          stage: "retry-login",
          status: retry.status,
          body: await retry.text(),
        };
      }

      return { ok: true, action: "signup+login" };
    },
    { email, password },
  );

  if (!authResult.ok) {
    throw new Error(
      `Auth failed at ${authResult.stage} (${authResult.status}): ${snippet(authResult.body)}`,
    );
  }

  const setup = await page.evaluate(
    async ({ harnessId, model }) => {
      const sessionResp = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `browser-repro-${Date.now()}` }),
        credentials: "include",
      });
      const sessionBody = await sessionResp.json().catch(() => null);
      if (!sessionResp.ok || !sessionBody?.id) {
        return {
          ok: false,
          stage: "create-session",
          status: sessionResp.status,
          body: sessionBody,
        };
      }

      const nodeResp = await fetch(`/api/sessions/${sessionBody.id}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "browser-repro-agent",
          harnessId,
          model,
        }),
        credentials: "include",
      });
      const nodeBody = await nodeResp.json().catch(() => null);
      if (!nodeResp.ok || !nodeBody?.id) {
        return {
          ok: false,
          stage: "spawn-node",
          status: nodeResp.status,
          body: nodeBody,
          sessionId: sessionBody.id,
        };
      }

      return {
        ok: true,
        sessionId: sessionBody.id,
        nodeId: nodeBody.id,
      };
    },
    { harnessId, model },
  );

  if (!setup.ok) {
    throw new Error(
      `${setup.stage} failed (${setup.status}): ${snippet(JSON.stringify(setup.body ?? null))}`,
    );
  }

  diagnostics.sessionId = setup.sessionId;
  diagnostics.nodeId = setup.nodeId;

  await page.goto(`${baseUrl}/session/${setup.sessionId}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  const input = page.getByPlaceholder("Message...");
  await input.waitFor({ timeout: 10000 });
  await input.fill(message);
  await page.getByRole("button", { name: "Send message" }).click();

  const closedMessage = page.getByText(/^Cannot send: WebSocket /);
  const userMessage = page.getByText(message, { exact: true });

  let sawClosedMessage = false;
  try {
    await closedMessage.waitFor({ timeout: 4000 });
    sawClosedMessage = true;
  } catch {
    sawClosedMessage = false;
  }

  if (sawClosedMessage) {
    diagnostics.outcome = "websocket-closed-before-send";
    throw new Error("Browser UI reproduced the failure: Cannot send: WebSocket closed");
  }

  try {
    await userMessage.waitFor({ timeout: 6000 });
  } catch {
    diagnostics.outcome = "user-message-not-rendered";
    throw new Error("Browser UI never rendered the user message after clicking send");
  }

  try {
    await closedMessage.waitFor({ timeout: 2000 });
    diagnostics.outcome = "websocket-closed-after-render";
    throw new Error("Browser UI closed the websocket immediately after rendering the user message");
  } catch {
    // no-op: this is the healthy path
  }

  if (expectedReply) {
    const assistantReply = page.getByText(expectedReply, { exact: true }).last();
    try {
      await assistantReply.waitFor({ timeout: 25000 });
    } catch {
      diagnostics.outcome = "assistant-reply-not-rendered";
      throw new Error(`Browser UI never rendered the expected assistant reply: ${expectedReply}`);
    }
  }

  diagnostics.outcome = "passed";
  console.log(`PASS session=${setup.sessionId} node=${setup.nodeId}`);
} catch (error) {
  const wsEntries = await page.evaluate(() => window.__codexWsEntries ?? []).catch(() => []);
  diagnostics.browserInjectedWebSockets = wsEntries;
  diagnostics.error = error instanceof Error ? error.message : String(error);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  throw error;
} finally {
  const wsEntries = await page.evaluate(() => window.__codexWsEntries ?? []).catch(() => []);
  diagnostics.browserInjectedWebSockets = wsEntries;
  await writeFile(logPath, JSON.stringify(diagnostics, null, 2));
  await context.tracing.stop({ path: tracePath }).catch(() => {});
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
  console.log(`Artifacts: ${logPath}`);
  console.log(`Trace: ${tracePath}`);
  console.log(`Screenshot: ${screenshotPath}`);
}
