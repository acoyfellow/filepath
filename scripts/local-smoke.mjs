import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const PASSWORD = process.env.LOCAL_SMOKE_PASSWORD || "TestPass123!Path";
const OUTPUT_DIR = join(process.cwd(), "output", "playwright");

function parseDotEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    env[key] = value;
  }
  return env;
}

const localEnv = parseDotEnv(join(process.cwd(), ".env"));
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || localEnv.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY. Set it in the shell or .env before running bun run smoke:local.");
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

async function waitForEnabled(locator, timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!(await locator.isDisabled())) return;
    await locator.page().waitForTimeout(250);
  }
  throw new Error("Timed out waiting for enabled control");
}

async function waitForText(page, text, timeoutMs = 30_000) {
  await page.waitForFunction(
    (needle) => document.body?.innerText.includes(needle),
    text,
    { timeout: timeoutMs },
  );
}

async function createWorkspace(page, name) {
  await page.getByRole("button", { name: /\+ New workspace/i }).click();
  await page.getByRole("textbox", { name: "Name" }).fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(/\/workspace\//, { timeout: 20_000 });
}

async function openCreateAgentModal(page) {
  const createButtons = page.getByRole("button", { name: /new agent/i });
  await createButtons.first().click();
  await page.getByRole("dialog", { name: /new agent/i }).waitFor({ state: "visible" });
}

async function saveRouterKey(page) {
  await page.getByRole("textbox", { name: /OpenRouter key/i }).fill(OPENROUTER_API_KEY);
  await page.getByRole("button", { name: /save key/i }).click();
  await waitForText(page, "Model access is ready", 30_000);
}

async function createAgent(page, taskName) {
  await openCreateAgentModal(page);
  const nameInput = page.getByRole("textbox", { name: "name" });
  await nameInput.fill(taskName);
  const createButton = page.getByRole("button", { name: "create agent" });
  await waitForEnabled(createButton, 30_000);
  await createButton.click();
  await waitForText(page, taskName, 20_000);
}

async function deleteSelectedAgent(page) {
  await page.locator(".agent-list-item.selected .agent-list-item-menu").click();
  const deleteItem = page.locator('[data-slot="dropdown-menu-item"]', { hasText: "Delete" }).last();
  await deleteItem.waitFor({ state: "visible", timeout: 10_000 });
  await deleteItem.click({ force: true });
  const latestToast = page.locator(".fixed.bottom-4.right-4 > div").last();
  await latestToast.waitFor({ state: "visible", timeout: 10_000 });
  await latestToast.locator("button", { hasText: "Confirm" }).click();
}

async function deleteRemainingAgentsViaApi(page) {
  const workspaceId = page.url().split("/workspace/")[1];
  if (!workspaceId) {
    throw new Error("Unable to determine workspace id for cleanup");
  }

  await page.evaluate(async ({ workspaceId }) => {
    const response = await fetch(`/api/workspaces/${workspaceId}`);
    const payload = await response.json();
    const agents = Array.isArray(payload?.agents) ? payload.agents : [];
    for (const agent of agents) {
      if (!agent?.id) continue;
      await fetch(`/api/workspaces/${workspaceId}/agents/${agent.id}`, {
        method: "DELETE",
      });
    }
  }, { workspaceId });
}

const now = Date.now();
const email = `jordan+filepath-smoke-${now}@example.com`;
const workspaceName = `smoke-${now}`;
const primaryAgentName = `alpha-${String(now).slice(-4)}`;
const cancelAgentName = `cancel-${String(now).slice(-4)}`;

let browser;
let page;

try {
  browser = await chromium.launch({ headless: process.env.HEADED !== "1" });
  const context = await browser.newContext();
  page = await context.newPage();

  const artifactPrefix = join(OUTPUT_DIR, `local-smoke-${now}`);

  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
  await page.getByRole("textbox", { name: "Confirm Password" }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 20_000 });

  await createWorkspace(page, workspaceName);

  await openCreateAgentModal(page);
  await saveRouterKey(page);
  await page.getByRole("button", { name: "cancel" }).click();

  await openCreateAgentModal(page);
  await waitForText(page, "Model access is ready", 10_000);
  await page.getByRole("button", { name: "cancel" }).click();

  await createAgent(page, primaryAgentName);

  await page.getByRole("textbox", { name: /Start the first task|Describe the next task/i }).fill(
    "Reply with exactly: AGENT_SMOKE_OK",
  );
  await page.getByRole("button", { name: "Run task" }).click();
  await waitForText(page, "AGENT_SMOKE_OK", 45_000);
  await waitForText(page, "Task complete", 10_000);

  await page.reload({ waitUntil: "networkidle" });
  await waitForText(page, "AGENT_SMOKE_OK", 20_000);

  await createAgent(page, cancelAgentName);
  await page.getByRole("textbox", { name: /Start the first task|Describe the next task/i }).fill(
    "__filepath_local_wait__:15000:CANCEL_SHOULD_NOT_COMPLETE",
  );
  await page.getByRole("button", { name: "Run task" }).click();
  const cancelButton = page.locator("button.agent-detail-cancel");
  await cancelButton.waitFor({ state: "visible", timeout: 10_000 });
  await cancelButton.click();
  await waitForText(page, "Task cancelled", 20_000);

  await deleteSelectedAgent(page);
  await waitForText(page, primaryAgentName, 10_000);
  await deleteRemainingAgentsViaApi(page);
  await page.reload({ waitUntil: "networkidle" });
  await waitForText(page, "No agents yet", 10_000);

  console.log(JSON.stringify({
    ok: true,
    email,
    workspace: workspaceName,
    agents: [primaryAgentName, cancelAgentName],
    baseUrl: BASE_URL,
  }, null, 2));
} catch (error) {
  if (page) {
    const failureShot = join(OUTPUT_DIR, `local-smoke-${now}-failure.png`);
    await page.screenshot({ path: failureShot, fullPage: true }).catch(() => {});
    console.error(`Saved failure screenshot: ${failureShot}`);
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
}
