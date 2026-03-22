<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { afterNavigate, goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import { page } from "$app/state";
  import SEO from "$lib/components/SEO.svelte";
  import AgentDetailPane from "$lib/components/workspace/AgentDetailPane.svelte";
  import AgentSettingsDrawer from "$lib/components/workspace/AgentSettingsDrawer.svelte";
  import WorkspaceSidebar from "$lib/components/workspace/WorkspaceSidebar.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { workspaceNewConversationHandler } from "$lib/workspace-nav";
  import type { TaskMessage } from "$lib/components/workspace/TaskTranscript.svelte";
  import AgentConnection from "$lib/components/workspace/AgentConnection.svelte";
  import CreateAgentModal from "$lib/components/workspace/CreateAgentModal.svelte";
  import BotIcon from "@lucide/svelte/icons/bot";
  import type {
    AgentConfig,
    AgentCreateRequest,
    AgentRecord,
    AgentResult,
    AgentRuntimeActiveTask,
    AgentRuntimeSnapshot,
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
    closedAt?: string | number | Date | null;
    conversationState?: AgentRecord["conversationState"];
    latestInterruption?: AgentRecord["latestInterruption"];
    activeIdentity?: AgentRecord["activeIdentity"];
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
  type AccountKeysMasked = { openrouter: string | null; zen: string | null };

  let accountKeysOverride = $state<{ masked: AccountKeysMasked; error: string | null } | null>(null);
  const accountKeysMasked = $derived(accountKeysOverride?.masked ?? data.accountKeysMasked);
  const accountKeysError = $derived(accountKeysOverride?.error ?? data.accountKeysError);
  let taskMessagesByAgent = $state<Record<string, TaskMessage[]>>({});
  let resultsByAgent = $state<Record<string, AgentResult | null>>({});
  let agentNotices = $state<Record<string, AgentNotice | null>>({});
  /** Transcript hydration: avoid empty / “Ready” flash before first runtime fetch. */
  let runtimeLoadingByAgent = $state<Record<string, boolean>>({});
  let runtimeLoadedByAgent = $state<Record<string, boolean>>({});
  let agentConnectionRef = $state<{
    runTask: (content: string) => Promise<{ taskId: string; ok: boolean }>;
    cancelTask: () => void;
  } | null>(null);

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
      closedAt: row.closedAt ? normalizeTimestamp(row.closedAt) : null,
      conversationState: row.conversationState ?? "ready",
      latestInterruption: row.latestInterruption ?? null,
      activeIdentity: row.activeIdentity ?? null,
      tokens: Number(row.tokens ?? 0),
      createdAt: normalizeTimestamp(row.createdAt),
      updatedAt: normalizeTimestamp(row.updatedAt),
    };
  }

  /** Newest conversations first (sidebar + default selection). */
  function orderAgentsByCreatedAt(entries: AgentRecord[]): AgentRecord[] {
    return [...entries].sort(
      (left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id),
    );
  }

  function mapRowsToAgents(rows: unknown): AgentRecord[] {
    return orderAgentsByCreatedAt((rows as AgentRow[]).map(toAgent));
  }

  function pickSelectedId(rows: AgentRecord[], conversationParam: string | null): string | null {
    if (rows.length === 0) return null;
    if (conversationParam && rows.some((r) => r.id === conversationParam)) return conversationParam;
    return rows[0].id;
  }

  // svelte-ignore state_referenced_locally -- deliberate SSR/first-paint seed; afterNavigate reapplies on workspace change
  const seedAgents = mapRowsToAgents(data.agents);
  let agents = $state<AgentRecord[]>(seedAgents);
  let selectedId = $state<string | null>(
    pickSelectedId(seedAgents, page.url.searchParams.get("conversation")),
  );

  function syncConversationUrl(id: string | null) {
    if (!browser || !workspaceId) return;
    const u = new URL(page.url.href);
    if (id) u.searchParams.set("conversation", id);
    else u.searchParams.delete("conversation");
    const next = `${u.pathname}${u.search}`;
    const cur = `${page.url.pathname}${page.url.search}`;
    if (next === cur) return;
    void goto(next, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function ensureSelectionValid() {
    if (agents.length === 0) {
      if (selectedId !== null) selectedId = null;
      showSettings = false;
      void syncConversationUrl(null);
      return;
    }
    if (!selectedId || !agents.some((r) => r.id === selectedId)) {
      const id = agents[0].id;
      selectedId = id;
      void syncConversationUrl(id);
      void refreshAgentRuntime(id);
    }
  }

  afterNavigate(({ from, to }) => {
    if (!to?.params) return;
    const toWid = to.params.id ?? "";
    if (!toWid) return;

    const fromWid = from?.params?.id ?? null;
    if (fromWid !== toWid) {
      agents = mapRowsToAgents(data.agents);
      accountKeysOverride = null;
      showSettings = false;
    }

    const q = to.url.searchParams.get("conversation");
    if (agents.length === 0) {
      selectedId = null;
      showSettings = false;
      return;
    }

    const pick = pickSelectedId(agents, q);
    const needUrlFix = q === null || !agents.some((a) => a.id === q) || pick !== q;
    if (needUrlFix && pick) void syncConversationUrl(pick);

    const before = selectedId;
    selectedId = pick;
    if (pick && pick !== before) void refreshAgentRuntime(pick);
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
  let transcriptLoading = $derived(
    Boolean(
      selectedAgent &&
        (!runtimeLoadedByAgent[selectedAgent.id] || runtimeLoadingByAgent[selectedAgent.id]),
    ),
  );

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
      entry.id === agentId
        ? {
            ...entry,
            status,
            conversationState:
              entry.conversationState === "blocked" || entry.conversationState === "closed"
                ? entry.conversationState
                : status === "queued" ||
                      status === "starting" ||
                      status === "running" ||
                      status === "retrying"
                  ? "running"
                  : "ready",
            updatedAt: Date.now(),
          }
        : entry,
    );
  }

  /** DB may contain back-to-back duplicate assistant rows (legacy / adapters); collapse for display. */
  function dedupeConsecutiveAssistantDupes<
    T extends { role: string; content: string },
  >(rows: T[]): T[] {
    const out: T[] = [];
    for (const entry of rows) {
      if (entry.role === "assistant" && out.length > 0) {
        const prev = out[out.length - 1];
        if (prev.role === "assistant" && prev.content.trim() === entry.content.trim()) continue;
      }
      out.push(entry);
    }
    return out;
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

    const nextLoading = { ...runtimeLoadingByAgent };
    delete nextLoading[agentId];
    runtimeLoadingByAgent = nextLoading;
    const nextLoaded = { ...runtimeLoadedByAgent };
    delete nextLoaded[agentId];
    runtimeLoadedByAgent = nextLoaded;

    clearAgentNotice(agentId);
  }

  function applyRuntimeSnapshot(agentId: string, runtime: AgentRuntimeSnapshot | null) {
    if (!runtime) return;

    agents = agents.map((entry) =>
      entry.id === agentId
        ? {
            ...entry,
            status: runtime.status as AgentRecord["status"],
            conversationState:
              entry.conversationState === "blocked" || entry.conversationState === "closed"
                ? entry.conversationState
                : runtime.status === "queued" ||
                      runtime.status === "starting" ||
                      runtime.status === "running" ||
                      runtime.status === "retrying"
                  ? "running"
                  : "ready",
            activeProcessId: runtime.activeProcessId ?? null,
            updatedAt: Date.now(),
          }
        : entry,
    );
    const thread = dedupeConsecutiveAssistantDupes(runtime.messages);
    taskMessagesByAgent = {
      ...taskMessagesByAgent,
      [agentId]: thread.map((entry) => ({
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

    if (runtime.status === "error") {
      setAgentNotice(agentId, {
        tone: "error",
        title: "Task failed",
        message: "Something went wrong while running this task.",
        blocking: true,
      });
      return;
    }

    clearAgentNotice(agentId);
  }

  async function refreshWorkspace() {
    if (!workspaceId) return;
    const response = await fetch(`/api/workspaces/${workspaceId}`);
    if (!response.ok) return;
    const payload = (await response.json()) as { agents: AgentRow[] };
    agents = orderAgentsByCreatedAt(payload.agents.map(toAgent));
    ensureSelectionValid();
  }

  async function refreshAgentRuntime(agentId: string) {
    runtimeLoadingByAgent = { ...runtimeLoadingByAgent, [agentId]: true };
    try {
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
    } finally {
      runtimeLoadingByAgent = { ...runtimeLoadingByAgent, [agentId]: false };
      runtimeLoadedByAgent = { ...runtimeLoadedByAgent, [agentId]: true };
    }
  }

  function handleSelect(id: string) {
    if (selectedId === id) return;
    selectedId = id;
    void syncConversationUrl(id);
    void refreshAgentRuntime(id);
  }

  function handleNavigate(name: string) {
    const target = agents.find((entry) => entry.name === name);
    if (!target) return;
    selectedId = target.id;
    void syncConversationUrl(target.id);
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
    if (selectedAgent.closedAt) {
      setAgentNotice(selectedAgent.id, {
        tone: "warning",
        title: "Conversation closed",
        message: "Reopen this conversation before sending another turn.",
        blocking: true,
      });
      return;
    }
    if (selectedAgent.latestInterruption?.status === "pending") {
      setAgentNotice(selectedAgent.id, {
        tone: "warning",
        title: "Conversation blocked",
        message: selectedAgent.latestInterruption.summary,
        blocking: true,
      });
      return;
    }

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
    if (selectedId === agentId && agentConnectionRef) {
      agentConnectionRef.cancelTask();
      return;
    }

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

      if (agentConnectionRef) {
        await agentConnectionRef.runTask(content);
      } else {
        throw new Error("Agent not connected. Reload the page.");
      }
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
    void syncConversationUrl(payload.id);
    await refreshAgentRuntime(payload.id);
    showSpawn = false;
  }

  async function postConversationAction(
    agentId: string,
    action: "close" | "reopen" | "pause" | "resume" | "approve" | "reject",
  ) {
    const response = await fetch(`/api/workspaces/${workspaceId}/agents/${agentId}/${action}`, {
      method: "POST",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      throw new Error(data.error || data.message || `Unable to ${action} conversation`);
    }

    await refreshWorkspace();
    await refreshAgentRuntime(agentId);
  }

  onMount(() => {
    workspaceNewConversationHandler.set(() => {
      showSpawn = true;
    });
    const id = selectedId ?? agents[0]?.id ?? null;
    if (id) void refreshAgentRuntime(id);
  });

  onDestroy(() => {
    workspaceNewConversationHandler.set(null);
  });
</script>

<SEO
  title={selectedAgent ? `${selectedAgent.name} | ${data.workspace.name}` : `${data.workspace.name}`}
  description={`Manage ${data.workspace.name} and its bounded background conversations (agent-backed threads), tasks, results, and settings.`}
  keywords="filepath workspace, conversations, tasks, results"
  path={`/workspace/${workspaceId}`}
  type="website"
  section="Workspace"
  tags="workspace,conversations,tasks"
  noindex
  breadcrumbs={[
    { name: "Dashboard", item: "/dashboard" },
    { name: data.workspace.name, item: `/workspace/${workspaceId}` },
  ]}
/>

<div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-(--bg2) text-(--t2) [--header-height:3.5rem]">
  {#if selectedAgent && data.agentBaseUrl}
    {#key selectedAgent.id}
      <AgentConnection
        bind:this={agentConnectionRef}
        agentId={selectedAgent.id}
        agentBaseUrl={data.agentBaseUrl}
        onMessages={(msgs) => {
          // `AgentConnection` only emits *assistant* events from its websocket session.
          // Merging prevents wiping the persisted thread (and the user message we
          // optimistically appended) when the adapter errors or when we refresh.
          const agentId = selectedAgent.id;
          const existing = taskMessagesByAgent[agentId] ?? [];
          const existingAssistant = existing.filter((m) => m.from === "a");

          const eventKey = (event: unknown) => {
            try {
              return JSON.stringify(event);
            } catch {
              return String(event);
            }
          };

          const incomingAssistant = msgs;
          const maxOverlap = Math.min(existingAssistant.length, incomingAssistant.length);
          let overlap = 0;

          for (let k = maxOverlap; k >= 0; k -= 1) {
            let ok = true;
            for (let i = 0; i < k; i += 1) {
              const left = existingAssistant[existingAssistant.length - k + i];
              const right = incomingAssistant[i];
              if (eventKey(left?.event) !== eventKey(right?.event)) {
                ok = false;
                break;
              }
            }
            if (ok) {
              overlap = k;
              break;
            }
          }

          const toAppend = incomingAssistant.slice(overlap);
          if (toAppend.length === 0) return;

          taskMessagesByAgent = {
            ...taskMessagesByAgent,
            [agentId]: [...existing, ...toAppend],
          };
        }}
        onResult={(res) => {
          resultsByAgent = { ...resultsByAgent, [selectedAgent.id]: res };
        }}
        onStatus={(status) => setAgentStatus(selectedAgent.id, status)}
        onError={(msg) =>
          (setAgentNotice(selectedAgent.id, {
            tone: "error",
            title: "Task failed",
            message: msg,
            blocking: true,
          }),
          // Ensure the UI re-renders the full persisted transcript after failures.
          // Without this, some adapter errors can leave the websocket transcript incomplete until refresh.
          setTimeout(() => {
            void refreshAgentRuntime(selectedAgent.id);
          }, 250))}
      />
    {/key}
  {/if}

  {#if agents.length > 0}
    <Sidebar.Provider class="flex min-h-0! flex-1 flex-col">
      <!-- Desktop: fixed-width sidebar + main -->
      <div class="hidden min-h-0 min-w-0 flex-1 overflow-hidden md:flex">
        <div class="flex h-full min-h-0 w-64 shrink-0 flex-col">
          <WorkspaceSidebar
            agents={agents}
            {selectedId}
            onselect={handleSelect}
            onrename={handleRenameAgent}
            ondelete={handleDeleteAgent}
          />
        </div>
        <Sidebar.Inset class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-(--bg2)">
          <AgentDetailPane
            agent={selectedAgent}
            activeTask={selectedActiveTask}
            messages={currentMessages}
            result={selectedResult}
            notice={selectedNotice}
            transcriptLoading={transcriptLoading}
            onsend={handleSend}
            oncancel={() => {
              if (!selectedAgent) return;
              void handleCancelAgent(selectedAgent.id);
            }}
            onpause={() => {
              if (!selectedAgent) return;
              void postConversationAction(selectedAgent.id, "pause");
            }}
            onresume={() => {
              if (!selectedAgent) return;
              void postConversationAction(selectedAgent.id, "resume");
            }}
            onapprove={() => {
              if (!selectedAgent) return;
              void postConversationAction(selectedAgent.id, "approve");
            }}
            onreject={() => {
              if (!selectedAgent) return;
              void postConversationAction(selectedAgent.id, "reject");
            }}
            onclose={() => {
              if (!selectedAgent) return;
              void postConversationAction(selectedAgent.id, "close");
            }}
            onreopen={() => {
              if (!selectedAgent) return;
              void postConversationAction(selectedAgent.id, "reopen");
            }}
            onopensettings={() => {
              if (!selectedAgent) return;
              showSettings = true;
            }}
            onnavigate={handleNavigate}
          />
        </Sidebar.Inset>
      </div>

      <!-- Mobile: sidebar drawer + main -->
      <div class="flex min-h-0 min-w-0 flex-1 overflow-hidden md:hidden">
        <WorkspaceSidebar
          agents={agents}
          {selectedId}
          onselect={handleSelect}
          onrename={handleRenameAgent}
          ondelete={handleDeleteAgent}
        />
        <Sidebar.Inset class="flex min-h-0 flex-1 flex-col overflow-hidden bg-(--bg2)">
          <AgentDetailPane
            agent={selectedAgent}
            activeTask={selectedActiveTask}
            messages={currentMessages}
            result={selectedResult}
            notice={selectedNotice}
            transcriptLoading={transcriptLoading}
            onsend={handleSend}
            oncancel={() => {
              if (!selectedAgent) return;
              void handleCancelAgent(selectedAgent.id);
            }}
            onpause={() => {
              if (!selectedAgent) return;
              void postConversationAction(selectedAgent.id, "pause");
            }}
            onresume={() => {
              if (!selectedAgent) return;
              void postConversationAction(selectedAgent.id, "resume");
            }}
            onapprove={() => {
              if (!selectedAgent) return;
              void postConversationAction(selectedAgent.id, "approve");
            }}
            onreject={() => {
              if (!selectedAgent) return;
              void postConversationAction(selectedAgent.id, "reject");
            }}
            onclose={() => {
              if (!selectedAgent) return;
              void postConversationAction(selectedAgent.id, "close");
            }}
            onreopen={() => {
              if (!selectedAgent) return;
              void postConversationAction(selectedAgent.id, "reopen");
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
      <div class="flex h-16 w-16 items-center justify-center text-(--t5) opacity-60">
        <BotIcon size={44} />
      </div>
      <p class="max-w-sm text-sm text-(--t4)">
        No conversations yet. Use <span class="font-medium text-(--t1)">+</span> next to the logo to create one.
      </p>
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
      accountKeysOverride = {
        masked: {
          openrouter: keys.openrouter ?? null,
          zen: keys.zen ?? null,
        },
        error,
      };
    }}
    lastAgent={selectedAgent?.harnessId}
    lastModel={selectedAgent?.model}
    {accountKeysMasked}
    accountKeysError={accountKeysError}
  />
{/if}

{#if showSettings && selectedAgent}
  <div transition:fly={{ x: 24, opacity: 0, duration: 180 }}>
    <AgentSettingsDrawer
      agent={selectedAgent}
      open={showSettings}
      onclose={() => {
        showSettings = false;
      }}
      onsave={handleUpdateAgent}
      onkeyschange={({ keys, error }) => {
        accountKeysOverride = {
          masked: {
            openrouter: keys.openrouter ?? null,
            zen: keys.zen ?? null,
          },
          error,
        };
      }}
      {accountKeysMasked}
      accountKeysError={accountKeysError}
    />
  </div>
{/if}
