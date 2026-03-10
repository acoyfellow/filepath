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

export async function runAdapter({ harnessId, systemPrompt }) {
  const task = readRequiredEnv("FILEPATH_TASK");
  const apiKey = readRequiredEnv("FILEPATH_API_KEY");
  const model = readRequiredEnv("FILEPATH_MODEL");

  emit({ type: "status", state: "thinking" });

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
