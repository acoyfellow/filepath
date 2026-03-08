import process from "node:process";
import WebSocket from "ws";

const [wsUrl, nodeId, sessionId, prompt, timeoutArg = "25000"] = process.argv.slice(2);

if (!wsUrl || !nodeId || !sessionId || !prompt) {
  console.error(
    "Usage: node gates/lib/send-chat-and-wait.mjs <ws_url> <node_id> <session_id> <prompt> [timeout_ms]",
  );
  process.exit(1);
}

const timeoutMs = Number.parseInt(timeoutArg, 10);
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error(`Invalid timeout: ${timeoutArg}`);
  process.exit(1);
}

const expectedReply = process.env.EXPECTED_REPLY?.trim() || null;
let headers = undefined;

if (process.env.WS_HEADERS_JSON) {
  try {
    const parsed = JSON.parse(process.env.WS_HEADERS_JSON);
    headers = Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, String(value)]),
    );
  } catch (error) {
    console.error(
      `Invalid WS_HEADERS_JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

if (process.env.WS_COOKIE) {
  headers = {
    ...(headers ?? {}),
    Cookie: process.env.WS_COOKIE,
  };
}

let settled = false;
const ws = new WebSocket(wsUrl, headers ? { headers } : undefined);

const finish = (code, output = "") => {
  if (settled) {
    return;
  }
  settled = true;
  clearTimeout(timer);
  if (output) {
    console.log(output);
  }
  try {
    ws.close();
  } catch {
    // Ignore close failures on the way out.
  }
  process.exit(code);
};

const timer = setTimeout(() => {
  finish(1, "TIMEOUT");
}, timeoutMs);

ws.on("open", () => {
  ws.send(
    JSON.stringify({
      type: "message",
      content: prompt,
      nodeId,
      sessionId,
    }),
  );
});

ws.on("message", (data) => {
  let payload = null;
  try {
    payload = JSON.parse(data.toString());
  } catch {
    return;
  }

  if (payload?.type === "error") {
    finish(1, `ERROR:${payload.message ?? "Unknown error"}`);
    return;
  }

  const event = payload?.event;
  if (payload?.type === "event" && event?.type === "text") {
    const reply = String(event.content ?? "").trim();
    if (expectedReply && reply !== expectedReply) {
      finish(1, `UNEXPECTED_RESPONSE:${reply.slice(0, 200)}`);
      return;
    }

    finish(0, `RESPONSE:${reply.slice(0, 200)}`);
  }
});

ws.on("error", (error) => {
  finish(1, `WS_ERROR:${error.message}`);
});
