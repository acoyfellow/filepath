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
  await page.getByRole("button", { name: /new workspace/i }).click();
  await page.getByRole("textbox", { name: "Name" }).fill(name);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(/\/workspace\//, { timeout: 20_000 });
}

async function openCreateAgentModal(page) {
  await page.getByTestId("open-create-agent").first().click();
  await page.getByRole("dialog", { name: /new agent/i }).waitFor({ state: "visible" });
}

async function openAgentSettings(page) {
  await page.getByTestId("open-agent-settings").click();
  await page.getByTestId("agent-settings-drawer").waitFor({ state: "visible" });
}

async function waitForModelValue(page, timeoutMs = 20_000) {
  const select = page.locator('[data-testid="agent-settings-drawer"] select[aria-label="Model"]');
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await select.inputValue();
    if (value) return value;
    await page.waitForTimeout(250);
  }
  throw new Error("Timed out waiting for model selection");
}

async function pickAlternateModel(page) {
  const select = page.locator('[data-testid="agent-settings-drawer"] select[aria-label="Model"]');
  await waitForEnabled(select, 20_000);
  await waitForModelValue(page, 20_000);
  const selection = await select.evaluate((element) => {
    const current = element.value;
    const alternate = Array.from(element.options)
      .map((option) => option.value)
      .find((value) => value && value !== current);
    return { current, alternate: alternate ?? null };
  });

  if (!selection.alternate) {
    throw new Error("No alternate model available for settings test");
  }

  await select.selectOption(selection.alternate);
  return selection.alternate;
}

async function pickAlternateHarness(page) {
  const selectedHarnessId = await page
    .locator('[data-testid="agent-settings-drawer"] [data-harness-id][data-selected="true"]')
    .getAttribute("data-harness-id");
  const alternateHarnessId = await page
    .locator('[data-testid="agent-settings-drawer"] [data-harness-id]')
    .evaluateAll((elements, current) => {
      const match = elements.find((element) => element.getAttribute("data-harness-id") !== current);
      return match?.getAttribute("data-harness-id") ?? null;
    }, selectedHarnessId);

  if (!alternateHarnessId) {
    throw new Error("No alternate harness available for settings test");
  }

  await page
    .locator(`[data-testid="agent-settings-drawer"] [data-harness-id="${alternateHarnessId}"]`)
    .click();

  return alternateHarnessId;
}

async function saveAgentSettings(page) {
  await page.getByRole("button", { name: "save changes" }).click();
}

async function expectPersistedSettings(page, { model, harnessId = null }) {
  await openAgentSettings(page);
  await waitForModelValue(page, 20_000);
  const currentModel = await page
    .locator('[data-testid="agent-settings-drawer"] select[aria-label="Model"]')
    .inputValue();
  if (currentModel !== model) {
    throw new Error(`Expected model ${model}, got ${currentModel}`);
  }

  if (harnessId) {
    const currentHarnessId = await page
      .locator('[data-testid="agent-settings-drawer"] [data-harness-id][data-selected="true"]')
      .getAttribute("data-harness-id");
    if (currentHarnessId !== harnessId) {
      throw new Error(`Expected harness ${harnessId}, got ${currentHarnessId}`);
    }
  }

  await page.getByRole("button", { name: "Close settings" }).click();
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
  const createButton = page.getByRole("button", { name: "create agent", exact: true });
  await waitForEnabled(createButton, 30_000);
  await createButton.click();
  await waitForText(page, taskName, 20_000);
}

async function deleteSelectedAgent(page) {
  await page.locator('[data-testid="agent-list-item"][data-selected="true"] [data-testid="agent-list-item-menu"]').click();
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

  await openAgentSettings(page);
  await waitForText(page, "Model access is ready", 10_000);
  const savedHarnessId = await pickAlternateHarness(page);
  const savedModel = await pickAlternateModel(page);
  await saveAgentSettings(page);
  await waitForText(page, "Settings saved", 10_000);
  await page.reload({ waitUntil: "networkidle" });
  await waitForText(page, primaryAgentName, 20_000);
  await expectPersistedSettings(page, { model: savedModel, harnessId: savedHarnessId });

  await page.getByRole("textbox", { name: /Start the first task|Describe the next task/i }).fill(
    "Reply with exactly: AGENT_SMOKE_OK",
  );
  await page.getByRole("button", { name: "Run task" }).click();
  await waitForText(page, "AGENT_SMOKE_OK", 45_000);

  await page.reload({ waitUntil: "networkidle" });
  await waitForText(page, "AGENT_SMOKE_OK", 20_000);

  await createAgent(page, cancelAgentName);
  await page.getByRole("textbox", { name: /Start the first task|Describe the next task/i }).fill(
    "__filepath_local_wait__:15000:CANCEL_SHOULD_NOT_COMPLETE",
  );
  await page.getByRole("button", { name: "Run task" }).click();
  const cancelButton = page.getByRole("button", { name: "Cancel active task" });
  await cancelButton.waitFor({ state: "visible", timeout: 10_000 });

  await openAgentSettings(page);
  const runningSavedModel = await pickAlternateModel(page);
  await saveAgentSettings(page);
  await waitForText(page, "Changes apply to the next task.", 10_000);
  await cancelButton.waitFor({ state: "visible", timeout: 10_000 });
  await cancelButton.click();
  await waitForText(page, "The agent task was cancelled.", 20_000);
  await expectPersistedSettings(page, { model: runningSavedModel });

  await page.getByRole("textbox", { name: /Start the first task|Describe the next task/i }).fill(
    "Reply with exactly: NEXT_TASK_SETTINGS_OK",
  );
  await page.getByRole("button", { name: "Run task" }).click();
  await waitForText(page, "NEXT_TASK_SETTINGS_OK", 45_000);

  await deleteSelectedAgent(page);
  await waitForText(page, primaryAgentName, 10_000);
  await deleteRemainingAgentsViaApi(page);
  await page.reload({ waitUntil: "networkidle" });
  await waitForText(page, "No agents yet", 10_000);

  if (process.env.FILEPATH_SMOKE_CUSTOM === "1") {
    const customHarnessBtn = page.locator('[data-testid="agent-settings-drawer"] [data-harness-id="custom"]').first();
    const customVisible = (await customHarnessBtn.count()) > 0;
    if (customVisible) {
      await createAgent(page, `custom-smoke-${now}`);
      await openAgentSettings(page);
      await customHarnessBtn.click();
      await saveAgentSettings(page);
      await waitForText(page, "Settings saved", 10_000);
      await page.getByRole("textbox", { name: /Start the first task|Describe the next task/i }).fill(
        "Reply with exactly: CUSTOM_HARNESS_OK",
      );
      await page.getByRole("button", { name: "Run task" }).click();
      await waitForText(page, "CUSTOM_HARNESS_OK", 90_000);
      await deleteRemainingAgentsViaApi(page);
      console.log("Custom harness smoke passed");
    } else {
      console.log("Custom harness not available (disabled). Skip FILEPATH_SMOKE_CUSTOM or enable custom in Harness registry.");
    }
  }

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
