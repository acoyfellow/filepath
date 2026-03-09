<script lang="ts">
  import "$lib/styles/theme.css";
  import { onDestroy, onMount } from "svelte";
  import { page } from "$app/state";
  import { DEFAULT_MODEL } from "$lib/config";
  import { createNodeClient, type ConnectionState, type DOMessage } from "$lib/agents/node-client";
  import AgentPanel from "$lib/components/session/AgentPanel.svelte";
  import AgentTree from "$lib/components/session/AgentTree.svelte";
  import type { ChatMsg } from "$lib/components/session/ChatView.svelte";
  import SpawnModal from "$lib/components/session/SpawnModal.svelte";
  import type {
    AgentNode,
    AgentNodeConfig,
    HarnessId,
    SpawnRequest,
    ThreadMovePayload,
  } from "$lib/types/session";

  interface SessionNodeRow {
    id: string;
    sessionId: string;
    parentId: string | null;
    name: string;
    harnessId: string;
    model: string;
    status: string;
    config: string | AgentNodeConfig | null;
    containerId: string | null;
    sortOrder: number;
    tokens: number;
    createdAt: string | number | Date;
    updatedAt: string | number | Date;
  }

  type SessionEventMessage =
    ({ type: "tree_update"; action?: string } & ThreadMovePayload);

  let { data } = $props();

  const sessionId = $derived(page.params.id ?? "");

  let showSpawn = $state(false);
  let workerUrl = $state<string | null>(null);
  let activeClients = $state<Record<string, ReturnType<typeof createNodeClient>>>({});
  let connectionStates = $state<Record<string, ConnectionState>>({});
  let sessionEventsSocket = $state<WebSocket | null>(null);
  let sessionEventsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let sessionEventsReconnectAttempts = 0;

  const MAX_SESSION_EVENT_RECONNECTS = 5;
  const SESSION_EVENT_RECONNECT_BASE_DELAY = 1000;

  function normalizeTimestamp(value: string | number | Date): number {
    if (typeof value === "number") return value;
    if (value instanceof Date) return value.getTime();

    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw new Error("Invalid timestamp in session payload");
    }

    return parsed;
  }

  function parseNodeConfig(config: string | AgentNodeConfig | null): AgentNodeConfig {
    if (typeof config === "string") {
      return config ? JSON.parse(config) as AgentNodeConfig : {};
    }

    return config ?? {};
  }

  function buildTree(flatNodes: SessionNodeRow[]): AgentNode | null {
    if (flatNodes.length === 0) return null;

    const nodeMap = new Map<string, AgentNode>();

    for (const node of flatNodes) {
      nodeMap.set(node.id, {
        id: node.id,
        sessionId: node.sessionId,
        parentId: node.parentId,
        name: node.name,
        harnessId: node.harnessId as HarnessId,
        model: node.model,
        status: node.status as AgentNode["status"],
        config: parseNodeConfig(node.config),
        containerId: node.containerId ?? undefined,
        sortOrder: node.sortOrder,
        tokens: node.tokens,
        children: [],
        createdAt: normalizeTimestamp(node.createdAt),
        updatedAt: normalizeTimestamp(node.updatedAt),
      });
    }

    const roots: AgentNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
        continue;
      }

      roots.push(node);
    }

    return roots[0] ?? null;
  }

  function flattenTree(
    nodes: Array<Record<string, unknown>>,
    out: SessionNodeRow[] = [],
  ): SessionNodeRow[] {
    for (const node of nodes) {
      out.push({
        id: String(node.id),
        sessionId: String(node.sessionId),
        parentId: typeof node.parentId === "string" ? node.parentId : null,
        name: String(node.name),
        harnessId: String(node.harnessId),
        model: String(node.model),
        status: String(node.status),
        config: (node.config ?? null) as string | AgentNodeConfig | null,
        containerId: typeof node.containerId === "string" ? node.containerId : null,
        sortOrder: Number(node.sortOrder ?? 0),
        tokens: Number(node.tokens ?? 0),
        createdAt: node.createdAt as string | number | Date,
        updatedAt: node.updatedAt as string | number | Date,
      });

      const children = Array.isArray(node.children)
        ? node.children as Array<Record<string, unknown>>
        : [];
      flattenTree(children, out);
    }

    return out;
  }

  function createInitialState() {
    const rootNode = buildTree(data.nodes as SessionNodeRow[]);
    return {
      rootNode,
      selectedId: rootNode?.id ?? null,
    };
  }

  const initialState = createInitialState();

  let rootNode = $state<AgentNode | null>(initialState.rootNode);
  let selectedId = $state<string | null>(initialState.selectedId);
  let messagesByNode = $state<Record<string, ChatMsg[]>>({});

  function findNode(node: AgentNode, id: string): AgentNode | null {
    if (node.id === id) return node;

    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }

    return null;
  }

  function findByName(node: AgentNode, name: string): AgentNode | null {
    if (node.name === name) return node;

    for (const child of node.children) {
      const found = findByName(child, name);
      if (found) return found;
    }

    return null;
  }

  let selectedAgent = $derived(
    selectedId && rootNode ? findNode(rootNode, selectedId) : null,
  );

  let currentMessages = $derived<ChatMsg[]>(
    selectedAgent ? (messagesByNode[selectedAgent.id] ?? []) : [],
  );

  function dropNodeConnection(nodeId: string) {
    const client = activeClients[nodeId];
    if (client) {
      client.close();
    }

    const nextClients = { ...activeClients };
    delete nextClients[nodeId];
    activeClients = nextClients;

    const nextStates = { ...connectionStates };
    delete nextStates[nodeId];
    connectionStates = nextStates;

    const nextMessages = { ...messagesByNode };
    delete nextMessages[nodeId];
    messagesByNode = nextMessages;
  }

  function ensureConnection(nodeId: string) {
    if (!workerUrl || activeClients[nodeId]) return;

    const client = createNodeClient(workerUrl, nodeId, {
      authToken: data.dashboardWsToken,
      onMessage: (msg: DOMessage) => handleDOMessage(nodeId, msg),
      onStateChange: (state: ConnectionState) => {
        connectionStates = { ...connectionStates, [nodeId]: state };
      },
    });

    activeClients = { ...activeClients, [nodeId]: client };
  }

  function ensureSessionEventsConnection() {
    if (!workerUrl || !sessionId || sessionEventsSocket) return;

    const base = new URL(workerUrl);
    base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(new URL(`/session-events/${sessionId}`, base));

    socket.onopen = () => {
      sessionEventsReconnectAttempts = 0;
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as SessionEventMessage;

      if (data.type === "tree_update" && data.action === "move") {
        void refreshSessionSnapshot();
        return;
      }
    };

    socket.onclose = () => {
      if (sessionEventsSocket !== socket) return;
      sessionEventsSocket = null;
      scheduleSessionEventsReconnect();
    };

    socket.onerror = () => {
      if (sessionEventsSocket !== socket) return;
      sessionEventsSocket = null;
      scheduleSessionEventsReconnect();
    };

    sessionEventsSocket = socket;
  }

  function scheduleSessionEventsReconnect() {
    if (!workerUrl || !sessionId || sessionEventsSocket || sessionEventsReconnectTimer) return;
    if (sessionEventsReconnectAttempts >= MAX_SESSION_EVENT_RECONNECTS) return;

    const delay = SESSION_EVENT_RECONNECT_BASE_DELAY * 2 ** sessionEventsReconnectAttempts;
    sessionEventsReconnectAttempts += 1;
    sessionEventsReconnectTimer = setTimeout(() => {
      sessionEventsReconnectTimer = null;
      ensureSessionEventsConnection();
    }, delay);
  }

  function setNodeStatus(nodeId: string, status: AgentNode["status"]) {
    if (!rootNode) return;

    const node = findNode(rootNode, nodeId);
    if (!node) return;

    node.status = status;
    rootNode = rootNode;
  }

  function handleDOMessage(nodeId: string, msg: DOMessage) {
    if (msg.type === "history" && msg.messages) {
      const history: ChatMsg[] = msg.messages.map((message) => ({
        from: message.role === "user" ? "u" : "a",
        event: { type: "text", content: message.content },
      }));
      messagesByNode = { ...messagesByNode, [nodeId]: history };
      return;
    }

    if (msg.type === "event" && msg.event) {
      if (msg.event.type === "status") {
        setNodeStatus(nodeId, msg.event.state as AgentNode["status"]);
        return;
      }

      const existing = messagesByNode[nodeId] ?? [];
      messagesByNode = {
        ...messagesByNode,
        [nodeId]: [...existing, { from: msg.role === "user" ? "u" : "a", event: msg.event }],
      };

      if (msg.event.type === "done") {
        setNodeStatus(nodeId, "done");
      }

      if (msg.event.type === "handoff") {
        setNodeStatus(nodeId, "exhausted");
      }

      return;
    }

    if (msg.type === "tree_update" && msg.action === "spawn" && msg.node && rootNode) {
      const node = msg.node;
      const parent = findNode(rootNode, nodeId);
      if (!parent) return;

      parent.children = [
        ...parent.children,
        {
          id: String(node.id),
          sessionId: String(node.sessionId ?? sessionId),
          parentId: String(node.parentId ?? nodeId),
          name: String(node.name ?? "agent"),
          harnessId: String(node.harnessId ?? "shelley") as HarnessId,
          model: String(node.model ?? DEFAULT_MODEL),
          status: "idle",
          config: {},
          sortOrder: Number(node.sortOrder ?? 0),
          tokens: Number(node.tokens ?? 0),
          children: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
      rootNode = rootNode;
      return;
    }

    if (msg.type === "error" && msg.message) {
      const existing = messagesByNode[nodeId] ?? [];
      messagesByNode = {
        ...messagesByNode,
        [nodeId]: [...existing, { from: "a", event: { type: "text", content: `Error: ${msg.message}` } }],
      };
    }
  }

  async function refreshSessionSnapshot() {
    if (!sessionId) return;

    const response = await fetch(`/api/sessions/${sessionId}`);
    if (!response.ok) return;

    const payload = await response.json() as { tree: Array<Record<string, unknown>> };
    const nextRootNode = buildTree(flattenTree(payload.tree));

    rootNode = nextRootNode;
    if (!nextRootNode) {
      selectedId = null;
      return;
    }

    if (!selectedId || !findNode(nextRootNode, selectedId)) {
      selectedId = nextRootNode.id;
      ensureConnection(nextRootNode.id);
    }
  }

  function handleSelect(id: string) {
    if (selectedId === id) return;
    selectedId = id;
    ensureConnection(id);
  }

  function handleNavigate(name: string) {
    if (!rootNode) return;

    const node = findByName(rootNode, name);
    if (!node) return;

    selectedId = node.id;
    ensureConnection(node.id);
  }

  async function handleMoveThread(payload: ThreadMovePayload) {
    if (!sessionId) return;

    const response = await fetch(`/api/sessions/${sessionId}/nodes/${payload.nodeId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentId: payload.parentId,
        sortOrder: payload.sortOrder,
      }),
    });

    if (!response.ok) {
      const data = await response.json() as { message?: string };
      throw new Error(data.message || "Unable to move agent");
    }

    await refreshSessionSnapshot();
  }

  async function handleRenameNode(payload: { nodeId: string; name: string }) {
    if (!sessionId) return;

    const response = await fetch(`/api/sessions/${sessionId}/nodes/${payload.nodeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: payload.name }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string; message?: string };
      throw new Error(data.error || data.message || "Unable to rename agent");
    }

    await refreshSessionSnapshot();
  }

  async function handleDeleteNode(nodeId: string) {
    if (!sessionId) return;

    const response = await fetch(`/api/sessions/${sessionId}/nodes/${nodeId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string; message?: string };
      throw new Error(data.error || data.message || "Unable to delete agent");
    }

    dropNodeConnection(nodeId);
    await refreshSessionSnapshot();
  }

  function handleSend(message: string) {
    if (!selectedAgent) return;
    if (selectedAgent.status === "exhausted") {
      return;
    }

    const nodeId = selectedAgent.id;
    const connectionState = connectionStates[nodeId];
    if (connectionState && connectionState !== "open") {
      const existing = messagesByNode[nodeId] ?? [];
      messagesByNode = {
        ...messagesByNode,
        [nodeId]: [...existing, { from: "a", event: { type: "text", content: `Cannot send: WebSocket ${connectionState}` } }],
      };
      return;
    }

    const existing = messagesByNode[nodeId] ?? [];
    messagesByNode = {
      ...messagesByNode,
      [nodeId]: [...existing, { from: "u", event: { type: "text", content: message } }],
    };

    ensureConnection(nodeId);
    const client = activeClients[nodeId];
    if (!client) {
      messagesByNode = {
        ...messagesByNode,
        [nodeId]: [
          ...messagesByNode[nodeId],
          { from: "a", event: { type: "text", content: "Connecting to agent..." } },
        ],
      };
      return;
    }

    try {
      client.send(message);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to send message";
      messagesByNode = {
        ...messagesByNode,
        [nodeId]: [...messagesByNode[nodeId], { from: "a", event: { type: "text", content: `Error: ${text}` } }],
      };
    }
  }

  async function handleSpawn(request: SpawnRequest) {
    if (!sessionId) return;

    const parentId = selectedAgent?.id ?? rootNode?.id;
    const response = await fetch(`/api/sessions/${sessionId}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: request.name,
        harnessId: request.harnessId,
        model: request.model,
        parentId,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string; message?: string };
      throw new Error(data.error || data.message || "Failed to spawn agent");
    }

    const data = await response.json() as { id: string };
    await refreshSessionSnapshot();
    selectedId = data.id;
    ensureConnection(data.id);
    showSpawn = false;
  }

  onMount(async () => {
    const response = await fetch("/api/config");
    const config = await response.json() as { workerUrl: string };

    workerUrl = config.workerUrl;
    ensureSessionEventsConnection();

    if (selectedId) {
      ensureConnection(selectedId);
    }
  });

  onDestroy(() => {
    for (const client of Object.values(activeClients)) {
      client.close();
    }

    if (sessionEventsReconnectTimer) {
      clearTimeout(sessionEventsReconnectTimer);
      sessionEventsReconnectTimer = null;
    }

    sessionEventsSocket?.close();
  });
</script>

<div class="session-root flex h-[calc(100vh-48px)] flex-1 flex-col overflow-hidden bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300">
  <div class="session-container @container flex h-full flex-1 overflow-hidden">
    {#if rootNode}
      <AgentTree
        root={rootNode}
        {selectedId}
        onselect={handleSelect}
        onmove={handleMoveThread}
        onrename={handleRenameNode}
        ondelete={handleDeleteNode}
        onspawn={() => {
          showSpawn = true;
        }}
      />

      <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AgentPanel
          agent={selectedAgent}
          messages={currentMessages}
          onsend={handleSend}
          onnavigate={handleNavigate}
        />
      </div>
    {:else}
      <div class="flex flex-1 flex-col items-center justify-center gap-4 bg-gray-50 pt-8 dark:bg-neutral-950">
        <p class="text-sm text-gray-600 dark:text-neutral-300">{data.session.name}</p>
        <p class="text-xs text-gray-500 dark:text-neutral-500">
          No agents yet. Spawn your first agent to get started.
        </p>
        <button
          onclick={() => {
            showSpawn = true;
          }}
          class="cursor-pointer rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          + spawn agent
        </button>
      </div>
    {/if}
  </div>
</div>

{#if showSpawn}
  <SpawnModal
    onclose={() => {
      showSpawn = false;
    }}
    onspawn={handleSpawn}
    lastAgent={selectedAgent?.harnessId}
    lastModel={selectedAgent?.model}
    accountKeysMasked={data.accountKeysMasked}
    accountKeysError={data.accountKeysError}
  />
{/if}
