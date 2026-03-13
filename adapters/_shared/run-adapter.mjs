const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function emit(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function extractTextContent(value) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

function parseLocalVerifyDirective(task) {
  const match = task.trim().match(/^__filepath_local_wait__:(\d+)(?::([\s\S]+))?$/);
  if (!match) return null;

  const delayMs = Math.min(Math.max(Number.parseInt(match[1], 10), 250), 60_000);
  const reply = match[2]?.trim() || `Waited ${delayMs}ms`;
  return { delayMs, reply };
}

export async function runAdapter({ harnessId, systemPrompt }) {
  const task = readRequiredEnv("FILEPATH_TASK");
  const apiKey = readRequiredEnv("FILEPATH_API_KEY");
  const model = readRequiredEnv("FILEPATH_MODEL");
  const localVerify = parseLocalVerifyDirective(task);

  emit({ type: "status", state: "thinking" });

  if (localVerify) {
    emit({ type: "status", state: "running" });
    await new Promise((resolve) => setTimeout(resolve, localVerify.delayMs));
    emit({ type: "text", content: localVerify.reply });
    emit({ type: "done", summary: "Agent completed the local verification task." });
    return;
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://myfilepath.com",
      "X-Title": `filepath-${harnessId}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: task,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `OpenRouter request failed (${response.status}): ${errorBody.slice(0, 400) || response.statusText}`,
    );
  }

  const payload = await response.json();
  const content = extractTextContent(payload?.choices?.[0]?.message?.content).trim();

  if (!content) {
    throw new Error("OpenRouter response did not include assistant text.");
  }

  emit({ type: "text", content });
  emit({ type: "done" });
}
