<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/state";
  import SEO from "$lib/components/SEO.svelte";
  import AgentDetailPane from "$lib/components/workspace/AgentDetailPane.svelte";
  import AgentSettingsDrawer from "$lib/components/workspace/AgentSettingsDrawer.svelte";
  import WorkspaceSidebar from "$lib/components/workspace/WorkspaceSidebar.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import type { TaskMessage } from "$lib/components/workspace/TaskTranscript.svelte";
  import CreateAgentModal from "$lib/components/workspace/CreateAgentModal.svelte";
  import type {
    AgentConfig,
    AgentCreateRequest,
    AgentRecord,
    AgentResult,
    AgentRuntimeActiveTask,
    AgentRuntimeSnapshot,
    AgentTaskAcceptedResponse,
    HarnessId,
    AgentUpdateRequest,
  } from "$lib/types/workspace";
  import type { ToolPermission } from "$lib/runtime/authority";

  interface AgentRow {
    id: string;
    workspaceId: string;
    name: string;
    harnessId: string;
    model: string;
    status: string;
    config: string | AgentConfig | null;
    allowedPaths: string | string[] | null;
    forbiddenPaths: string | string[] | null;
    toolPermissions: string | ToolPermission[] | null;
    writableRoot: string | null;
    containerId: string | null;
    activeProcessId?: string | null;
    tokens: number;
    createdAt: string | number | Date;
    updatedAt: string | number | Date;
  }

  type AgentNotice = {
    tone: "info" | "warning" | "error" | "success";
    title: string;
    message: string;
    blocking?: boolean;
  };

  let { data } = $props();

  const workspaceId = $derived(page.params.id ?? "");
  let showSpawn = $state(false);
  let showSettings = $state(false);
  let accountKeysMasked = $state<{ openrouter: string | null; zen: string | null }>({
    openrouter: null,
    zen: null,
  });
  let accountKeysError = $state<string | null>(null);
  let taskMessagesByAgent = $state<Record<string, TaskMessage[]>>({});
  let resultsByAgent = $state<Record<string, AgentResult | null>>({});
  let agentNotices = $state<Record<string, AgentNotice | null>>({});
  let selectedId = $state<string | null>(null);
  let isRefreshing = $state(false);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function normalizeTimestamp(value: string | number | Date): number {
    if (typeof value === "number") return value;
    if (value instanceof Date) return value.getTime();
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw new Error("Invalid timestamp in workspace payload");
    }
    return parsed;
  }

  function parseAgentConfig(config: string | AgentConfig | null): AgentConfig {
    if (typeof config === "string") {
      return config ? (JSON.parse(config) as AgentConfig) : {};
    }
    return config ?? {};
  }

  function parseJsonList(value: string | string[] | null): string[] {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    return JSON.parse(value) as string[];
  }

  function toAgent(row: AgentRow): AgentRecord {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      harnessId: row.harnessId as HarnessId,
      model: row.model,
      status: row.status as AgentRecord["status"],
      config: parseAgentConfig(row.config),
      allowedPaths: parseJsonList(row.allowedPaths),
      forbiddenPaths: parseJsonList(row.forbiddenPaths),
      toolPermissions: parseJsonList(row.toolPermissions) as ToolPermission[],
      writableRoot: row.writableRoot,
      containerId: row.containerId ?? undefined,
      activeProcessId: row.activeProcessId ?? null,
      tokens: Number(row.tokens ?? 0),
      createdAt: normalizeTimestamp(row.createdAt),
      updatedAt: normalizeTimestamp(row.updatedAt),
    };
  }

  function orderAgentsByCreatedAt(entries: AgentRecord[]): AgentRecord[] {
    return [...entries].sort(
      (left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id),
    );
  }

  let agents = $state<AgentRecord[]>([]);

  $effect(() => {
    agents = orderAgentsByCreatedAt((data.agents as AgentRow[]).map(toAgent));
  });

  $effect(() => {
    accountKeysMasked = data.accountKeysMasked;
    accountKeysError = data.accountKeysError;
  });

  $effect(() => {
    if (!selectedId && agents.length > 0) {
      selectedId = agents[0].id;
    } else if (selectedId && !agents.some((entry) => entry.id === selectedId)) {
      selectedId = agents[0]?.id ?? null;
    }
  });

  let selectedAgent = $derived(
    selectedId ? agents.find((entry) => entry.id === selectedId) ?? null : null,
  );
  let currentMessages = $derived(
    selectedAgent ? (taskMessagesByAgent[selectedAgent.id] ?? []) : [],
  );
  let selectedNotice = $derived(
    selectedAgent ? (agentNotices[selectedAgent.id] ?? null) : null,
  );
  let selectedResult = $derived(
    selectedAgent ? (resultsByAgent[selectedAgent.id] ?? null) : null,
  );
  let dataActiveTaskByAgent = $state<Record<string, AgentRuntimeActiveTask | null>>({});
  let selectedActiveTask = $derived(
    selectedAgent ? (dataActiveTaskByAgent[selectedAgent.id] ?? null) : null,
  );

  $effect(() => {
    if (showSettings && !selectedAgent) {
      showSettings = false;
    }
  });

  function setAgentNotice(agentId: string, notice: AgentNotice | null) {
    agentNotices = { ...agentNotices, [agentId]: notice };
  }

  function clearAgentNotice(agentId: string) {
    if (!(agentId in agentNotices)) return;
    const next = { ...agentNotices };
    delete next[agentId];
    agentNotices = next;
  }

  function setAgentStatus(agentId: string, status: AgentRecord["status"]) {
    agents = agents.map((entry) =>
      entry.id === agentId ? { ...entry, status, updatedAt: Date.now() } : entry,
    );
  }

  function dropAgentState(agentId: string) {
    const nextMessages = { ...taskMessagesByAgent };
    delete nextMessages[agentId];
    taskMessagesByAgent = nextMessages;

    const nextResults = { ...resultsByAgent };
    delete nextResults[agentId];
    resultsByAgent = nextResults;

    const nextTasks = { ...dataActiveTaskByAgent };
    delete nextTasks[agentId];
    dataActiveTaskByAgent = nextTasks;
    clearAgentNotice(agentId);
  }

  function applyRuntimeSnapshot(agentId: string, runtime: AgentRuntimeSnapshot | null) {
    if (!runtime) return;

    agents = agents.map((entry) =>
      entry.id === agentId
        ? {
            ...entry,
            status: runtime.status as AgentRecord["status"],
            activeProcessId: runtime.activeProcessId ?? null,
            updatedAt: Date.now(),
          }
        : entry,
    );
    taskMessagesByAgent = {
      ...taskMessagesByAgent,
      [agentId]: runtime.messages.map((entry) => ({
        from: entry.role === "user" ? "u" : "a",
        event: { type: "text", content: entry.content },
      })),
    };
    resultsByAgent = {
      ...resultsByAgent,
      [agentId]: runtime.result,
    };
    dataActiveTaskByAgent = {
      ...dataActiveTaskByAgent,
      [agentId]: runtime.activeTask ?? null,
    };

    if (runtime.activeTask) {
      clearAgentNotice(agentId);
      return;
    }

    if (runtime.status === "stalled") {
      setAgentNotice(agentId, {
        tone: "error",
        title: "Task stalled",
        message: runtime.result?.summary ?? "The task stopped reporting progress and was marked stalled.",
        blocking: true,
      });
      return;
    }

    if (runtime.result?.status === "error" || runtime.result?.status === "policy_error") {
      setAgentNotice(agentId, {
        tone: "error",
        title: runtime.result.status === "policy_error" ? "Task blocked" : "Task failed",
        message: runtime.result.summary || "The task failed before it could finish.",
        blocking: true,
      });
      return;
    }

    clearAgentNotice(agentId);
  }

  async function refreshWorkspace() {
    if (!workspaceId) return;
    isRefreshing = true;
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { agents: AgentRow[] };
      agents = orderAgentsByCreatedAt(payload.agents.map(toAgent));
    } finally {
      isRefreshing = false;
    }
  }

  async function refreshAgentRuntime(agentId: string) {
    const response = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}`);
    if (!response.ok) return;

    const payload = (await response.json()) as {
      agent?: AgentRow;
      runtime?: AgentRuntimeSnapshot | null;
    };

    if (payload.agent) {
      const next = toAgent(payload.agent);
      agents = orderAgentsByCreatedAt(
        agents.some((entry) => entry.id === next.id)
          ? agents.map((entry) => (entry.id === next.id ? next : entry))
          : [...agents, next],
      );
    }

    applyRuntimeSnapshot(agentId, payload.runtime ?? null);
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      if (selectedId) {
        void refreshAgentRuntime(selectedId);
      }
    }, 3000);
  }

  function handleSelect(id: string) {
    if (selectedId === id) return;
    selectedId = id;
    void refreshAgentRuntime(id);
  }

  function handleNavigate(name: string) {
    const target = agents.find((entry) => entry.name === name);
    if (!target) return;
    selectedId = target.id;
    void refreshAgentRuntime(target.id);
  }

  async function handleRenameAgent(payload: { agentId: string; name: string }) {
    const response = await fetch(`/api/workspaces/${workspaceId}/agents/${payload.agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: payload.name }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      throw new Error(data.error || data.message || "Unable to rename agent");
    }

    await refreshWorkspace();
  }

  async function handleDeleteAgent(agentId: string) {
    const response = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      throw new Error(data.error || data.message || "Unable to delete agent");
    }

    dropAgentState(agentId);
    if (selectedId === agentId) {
      showSettings = false;
    }
    await refreshWorkspace();
  }

  async function handleUpdateAgent(payload: AgentUpdateRequest) {
    if (!selectedAgent) return;

    const response = await fetch(`/api/workspaces/${workspaceId}/agents/${selectedAgent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      throw new Error(data.error || data.message || "Failed to update agent");
    }

    await refreshWorkspace();
    await refreshAgentRuntime(selectedAgent.id);
    setAgentNotice(selectedAgent.id, {
      tone: "success",
      title: "Settings saved",
      message:
        selectedActiveTask !== null
          ? "Saved. Changes apply to the next task."
          : "Saved. The next task will use the updated harness, model, and scope.",
    });
    showSettings = false;
  }

  async function handleCancelAgent(agentId: string) {
    const response = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}/cancel`, {
      method: "POST",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      throw new Error(data.error || data.message || "Unable to cancel agent");
    }

    await refreshAgentRuntime(agentId);
  }

  function handleSend(content: string) {
    void runAgentTask(content);
  }

  async function runAgentTask(content: string) {
    if (!selectedAgent) return;

    const agentId = selectedAgent.id;
    clearAgentNotice(agentId);
    taskMessagesByAgent = {
      ...taskMessagesByAgent,
      [agentId]: [
        ...(taskMessagesByAgent[agentId] ?? []),
        { from: "u", event: { type: "text", content } },
      ],
    };

    try {
      setAgentStatus(agentId, "queued");
      clearAgentNotice(agentId);

      const response = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        taskId?: string;
        state?: AgentTaskAcceptedResponse["state"];
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to run task");
      }

      await refreshAgentRuntime(agentId);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to send task";
      setAgentNotice(agentId, {
        tone: "error",
        title: "Task failed",
        message: text,
        blocking: true,
      });
      setAgentStatus(agentId, "error");
    }
  }

  async function handleCreateAgent(request: AgentCreateRequest) {
    const response = await fetch(`/api/workspaces/${workspaceId}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      throw new Error(data.error || data.message || "Failed to create agent");
    }

    const payload = (await response.json()) as { id: string };
    await refreshWorkspace();
    selectedId = payload.id;
    await refreshAgentRuntime(payload.id);
    showSpawn = false;
  }

  onMount(() => {
    startPolling();
    if (selectedId) {
      void refreshAgentRuntime(selectedId);
    } else if (agents[0]) {
      selectedId = agents[0].id;
      void refreshAgentRuntime(agents[0].id);
    }
  });

  onDestroy(() => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });
</script>

<SEO
  title={selectedAgent ? `${selectedAgent.name} | ${data.workspace.name}` : `${data.workspace.name}`}
  description={`Manage ${data.workspace.name} and its bounded background agents, tasks, results, and settings.`}
  keywords="filepath workspace, agents, tasks, results"
  path={`/workspace/${workspaceId}`}
  type="website"
  section="Workspace"
  tags="workspace,agents,tasks"
  noindex
  breadcrumbs={[
    { name: "Dashboard", item: "/dashboard" },
    { name: data.workspace.name, item: `/workspace/${workspaceId}` },
  ]}
/>

<div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-(--bg2) text-(--t2) [--header-height:3.5rem]">
  {#if agents.length > 0}
    <Sidebar.Provider class="flex min-h-0! flex-1 flex-col">
      <div class="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <WorkspaceSidebar
        isRefreshing={isRefreshing}
        agents={agents}
        {selectedId}
        onselect={handleSelect}
        onrename={handleRenameAgent}
        ondelete={handleDeleteAgent}
        oncreate={() => {
          showSpawn = true;
        }}
      />
      <Sidebar.Inset class="flex min-h-0 flex-1 flex-col overflow-hidden bg-(--bg2)">
        <AgentDetailPane
          agent={selectedAgent}
          activeTask={selectedActiveTask}
          messages={currentMessages}
          result={selectedResult}
          notice={selectedNotice}
          onsend={handleSend}
          oncancel={() => {
            if (!selectedAgent) return;
            void handleCancelAgent(selectedAgent.id);
          }}
          onopensettings={() => {
            if (!selectedAgent) return;
            showSettings = true;
          }}
          onnavigate={handleNavigate}
        />
      </Sidebar.Inset>
      </div>
    </Sidebar.Provider>
  {:else}
    <div class="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
        <p class="text-sm text-(--t2)">{data.workspace.name}</p>
        <p class="max-w-md text-xs leading-6 text-(--t4)">
          No agents yet. Create a scoped background agent to start using this workspace.
        </p>
        <button
          onclick={() => {
            showSpawn = true;
          }}
          data-testid="open-create-agent"
          class="rounded-xl bg-(--accent) px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          + new agent
        </button>
    </div>
  {/if}
</div>

{#if showSpawn}
  <CreateAgentModal
    onclose={() => {
      showSpawn = false;
    }}
    onspawn={handleCreateAgent}
    onkeyschange={({ keys, error }) => {
      accountKeysMasked = keys;
      accountKeysError = error;
    }}
    lastAgent={selectedAgent?.harnessId}
    lastModel={selectedAgent?.model}
    {accountKeysMasked}
    accountKeysError={accountKeysError}
  />
{/if}

{#if showSettings && selectedAgent}
  <AgentSettingsDrawer
    agent={selectedAgent}
    open={showSettings}
    onclose={() => {
      showSettings = false;
    }}
    onsave={handleUpdateAgent}
    onkeyschange={({ keys, error }) => {
      accountKeysMasked = keys;
      accountKeysError = error;
    }}
    {accountKeysMasked}
    accountKeysError={accountKeysError}
  />
{/if}
