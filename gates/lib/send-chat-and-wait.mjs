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

let settled = false;
const ws = new WebSocket(wsUrl);

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
    finish(0, `RESPONSE:${String(event.content ?? "").slice(0, 200)}`);
  }
});

ws.on("error", (error) => {
  finish(1, `WS_ERROR:${error.message}`);
});
