/**
 * inference-dispatch.mjs
 *
 * Plain JS mirror of @acoyfellow/ai-connect's dispatch logic, for use inside
 * the sandbox container (where TS / imports from npm packages are awkward).
 *
 * Container adapters import this to:
 *   - build the right request shape for FILEPATH_PROVIDER
 *   - parse the right response shape
 *   - return a normalized { content, usage, raw } regardless of provider
 *
 * When we change ai-connect's shapes, we have to update this file too.
 * Keep them in sync.
 */

/** @type {Record<string, string>} */
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

/**
 * Build the HTTP Request for a given provider.
 * @param {"anthropic"|"openai-chat"|"openai-responses"|"gemini"} provider
 * @param {string} endpoint
 * @param {string} model
 * @param {string} apiKey
 * @param {Array<{role: string, content: string}>} messages
 * @param {{maxTokens?: number, temperature?: number, headers?: Record<string,string>, signal?: AbortSignal}} opts
 * @returns {{ url: string, init: RequestInit }}
 */
function buildRequest(provider, endpoint, model, apiKey, messages, opts = {}) {
  const extra = opts.headers || {};
  const signal = opts.signal;
  switch (provider) {
    case "anthropic": {
      const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const convo = messages.filter((m) => m.role !== "system").map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const body = {
        model,
        messages: convo,
        max_tokens: opts.maxTokens != null ? opts.maxTokens : 4096,
      };
      if (sys) body.system = sys;
      if (opts.temperature !== undefined) body.temperature = opts.temperature;
      return {
        url: endpoint,
        init: {
          method: "POST",
          headers: {
            ...DEFAULT_HEADERS,
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            ...extra,
          },
          body: JSON.stringify(body),
          signal,
        },
      };
    }
    case "openai-chat": {
      const body = { model, messages };
      if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
      if (opts.temperature !== undefined) body.temperature = opts.temperature;
      return {
        url: endpoint,
        init: {
          method: "POST",
          headers: {
            ...DEFAULT_HEADERS,
            Authorization: `Bearer ${apiKey}`,
            ...extra,
          },
          body: JSON.stringify(body),
          signal,
        },
      };
    }
    case "openai-responses": {
      const input = messages.map((m) => ({
        role: m.role,
        content: [{ type: "input_text", text: m.content }],
      }));
      const body = { model, input };
      if (opts.maxTokens !== undefined) body.max_output_tokens = opts.maxTokens;
      if (opts.temperature !== undefined) body.temperature = opts.temperature;
      return {
        url: endpoint,
        init: {
          method: "POST",
          headers: {
            ...DEFAULT_HEADERS,
            Authorization: `Bearer ${apiKey}`,
            ...extra,
          },
          body: JSON.stringify(body),
          signal,
        },
      };
    }
    case "gemini": {
      let url = endpoint;
      if (!url.includes(":generateContent")) {
        url = `${url.replace(/\/$/, "")}/${model}:generateContent`;
      }
      const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
      /** @type {{contents: unknown[], system_instruction?: unknown, generationConfig: Record<string, unknown>}} */
      const body = {
        contents,
        generationConfig: {},
      };
      if (sys) body.system_instruction = { parts: [{ text: sys }] };
      if (opts.maxTokens !== undefined) body.generationConfig.maxOutputTokens = opts.maxTokens;
      if (opts.temperature !== undefined) body.generationConfig.temperature = opts.temperature;
      return {
        url,
        init: {
          method: "POST",
          headers: {
            ...DEFAULT_HEADERS,
            "x-goog-api-key": apiKey,
            ...extra,
          },
          body: JSON.stringify(body),
          signal,
        },
      };
    }
    default:
      throw new Error(`unknown provider: ${provider}`);
  }
}

/**
 * Parse a provider's response body into normalized { content, usage }.
 * @param {"anthropic"|"openai-chat"|"openai-responses"|"gemini"} provider
 * @param {unknown} json
 * @returns {{ content: string, usage?: { promptTokens?: number, completionTokens?: number, totalTokens?: number } }}
 */
function parseResponse(provider, json) {
  if (!json || typeof json !== "object") return { content: "" };
  const obj = /** @type {Record<string, any>} */ (json);
  if (obj.error) {
    throw new Error(obj.error.message || `${provider} returned an error`);
  }
  switch (provider) {
    case "anthropic": {
      const content = Array.isArray(obj.content)
        ? obj.content.filter((c) => c.type === "text").map((c) => c.text || "").join("")
        : "";
      const usage = obj.usage
        ? {
            promptTokens: obj.usage.input_tokens,
            completionTokens: obj.usage.output_tokens,
            totalTokens: (obj.usage.input_tokens || 0) + (obj.usage.output_tokens || 0),
          }
        : undefined;
      return { content, usage };
    }
    case "openai-chat": {
      const content = obj.choices?.[0]?.message?.content || "";
      const usage = obj.usage
        ? {
            promptTokens: obj.usage.prompt_tokens,
            completionTokens: obj.usage.completion_tokens,
            totalTokens: obj.usage.total_tokens,
          }
        : undefined;
      return { content, usage };
    }
    case "openai-responses": {
      let content = obj.output_text || "";
      if (!content && Array.isArray(obj.output)) {
        content = obj.output
          .flatMap((o) => o.content || [])
          .filter((c) => c.type === "output_text" || c.type === "text")
          .map((c) => c.text || "")
          .join("");
      }
      const usage = obj.usage
        ? {
            promptTokens: obj.usage.input_tokens,
            completionTokens: obj.usage.output_tokens,
            totalTokens: obj.usage.total_tokens,
          }
        : undefined;
      return { content, usage };
    }
    case "gemini": {
      const content =
        obj.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      const usage = obj.usageMetadata
        ? {
            promptTokens: obj.usageMetadata.promptTokenCount,
            completionTokens: obj.usageMetadata.candidatesTokenCount,
            totalTokens: obj.usageMetadata.totalTokenCount,
          }
        : undefined;
      return { content, usage };
    }
    default:
      throw new Error(`unknown provider: ${provider}`);
  }
}

/**
 * Call an inference endpoint using the normalized ai-connect request shapes.
 *
 * @param {object} args
 * @param {"anthropic"|"openai-chat"|"openai-responses"|"gemini"} args.provider
 * @param {string} args.endpoint
 * @param {string} args.model
 * @param {string} args.apiKey
 * @param {Array<{role: string, content: string}>} args.messages
 * @param {{maxTokens?: number, temperature?: number, headers?: Record<string,string>, signal?: AbortSignal}} [args.options]
 * @returns {Promise<{ content: string, usage?: object, raw: unknown }>}
 */
export async function callInference({ provider, endpoint, model, apiKey, messages, options = {} }) {
  const { url, init } = buildRequest(provider, endpoint, model, apiKey, messages, options);
  const response = await fetch(url, init);
  const bodyText = await response.text();
  /** @type {unknown} */
  let raw;
  try {
    raw = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    raw = bodyText;
  }
  if (!response.ok) {
    const errMsg =
      raw && typeof raw === "object" && raw.error && raw.error.message
        ? raw.error.message
        : typeof raw === "string"
        ? raw
        : `HTTP ${response.status}`;
    throw new Error(`Inference request failed (${response.status}): ${errMsg}`);
  }
  const parsed = parseResponse(provider, raw);
  return { content: parsed.content, usage: parsed.usage, raw };
}

/**
 * Read provider config from container env vars set by buildAgentEnv.
 * @returns {{ provider: string, endpoint: string, model: string, apiKey: string }}
 */
export function readInferenceEnv() {
  const provider = process.env.FILEPATH_PROVIDER || "openai-chat";
  const endpoint = process.env.FILEPATH_ENDPOINT || "";
  const model = process.env.FILEPATH_MODEL || "";
  const apiKey = process.env.FILEPATH_API_KEY || "";
  if (!endpoint) throw new Error("FILEPATH_ENDPOINT env var is required");
  if (!model) throw new Error("FILEPATH_MODEL env var is required");
  if (!apiKey) throw new Error("FILEPATH_API_KEY env var is required");
  return { provider, endpoint, model, apiKey };
}
