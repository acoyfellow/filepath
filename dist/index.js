// src/index.ts
import { existsSync, readFileSync } from "fs";
import { join } from "path";
var workerUrl = null;
function loadConfig() {
  const configPath = join(process.cwd(), ".filepath", "config.json");
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  return null;
}
function configure(url) {
  workerUrl = url;
}
async function run(instruction, options = {}) {
  const { timeout = 60000, debug = false } = options;
  let url = workerUrl;
  if (!url) {
    const config = loadConfig();
    if (config?.workerUrl) {
      url = config.workerUrl;
    }
  }
  if (!url) {
    url = process.env.FILEPATH_WORKER_URL || null;
  }
  if (!url) {
    return {
      success: false,
      output: "",
      screenshot: "",
      error: "No worker URL configured. Run `filepath init` and `filepath deploy` first, or set FILEPATH_WORKER_URL."
    };
  }
  if (debug) {
    console.log(`[filepath] POST ${url}/run`);
    console.log(`[filepath] instruction: ${instruction}`);
  }
  try {
    const controller = new AbortController;
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(`${url}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ instruction }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const result = await response.json();
    if (debug) {
      console.log(`[filepath] success: ${result.success}`);
      if (result.error)
        console.log(`[filepath] error: ${result.error}`);
    }
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : "unknown error";
    if (debug) {
      console.error(`[filepath] fetch error: ${error}`);
    }
    return {
      success: false,
      output: "",
      screenshot: "",
      error: `Failed to reach worker: ${error}`
    };
  }
}
var src_default = { run, configure };
export {
  run,
  src_default as default,
  configure
};
