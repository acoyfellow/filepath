import fs from "node:fs";
import process from "node:process";
import WebSocket from "ws";

const [wsUrl, expectedType, expectedAction = "", outputFile = "", timeoutArg = "8000"] =
  process.argv.slice(2);

if (!wsUrl || !expectedType) {
  console.error(
    "Usage: node gates/lib/wait-for-session-event.mjs <ws_url> <event_type> [action] [output_file] [timeout_ms]",
  );
  process.exit(1);
}

const timeoutMs = Number.parseInt(timeoutArg, 10);
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  console.error(`Invalid timeout: ${timeoutArg}`);
  process.exit(1);
}

const timer = setTimeout(() => {
  console.error(`Timed out waiting for ${expectedType}${expectedAction ? `/${expectedAction}` : ""}`);
  process.exit(2);
}, timeoutMs);

const ws = new WebSocket(wsUrl);

const maybePersist = (rawText) => {
  if (outputFile) {
    fs.writeFileSync(outputFile, rawText, "utf8");
  }
};

const matches = (payload, rawText) => {
  if (payload && typeof payload === "object") {
    const topLevelMatch =
      payload.type === expectedType && (!expectedAction || payload.action === expectedAction);
    if (topLevelMatch) {
      return true;
    }

    const event = payload.event;
    const nestedMatch =
      event &&
      typeof event === "object" &&
      event.type === expectedType &&
      (!expectedAction || event.action === expectedAction);
    if (nestedMatch) {
      return true;
    }
  }

  return (
    rawText.includes(`"type":"${expectedType}"`) &&
    (!expectedAction || rawText.includes(`"action":"${expectedAction}"`))
  );
};

ws.on("message", (data) => {
  const rawText = data.toString();
  let payload = null;

  try {
    payload = JSON.parse(rawText);
  } catch {
    payload = null;
  }

  if (matches(payload, rawText)) {
    clearTimeout(timer);
    maybePersist(rawText);
    ws.close();
    process.exit(0);
  }
});

ws.on("error", (error) => {
  clearTimeout(timer);
  console.error(`WebSocket error: ${error.message}`);
  process.exit(1);
});

ws.on("close", () => {
  // Let the timeout handle "no matching event" cases.
});
