<script lang="ts">
  import "$lib/styles/theme.css";
  import { dev } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import AgentTree from "$lib/components/session/AgentTree.svelte";
  import AgentPanel from "$lib/components/session/AgentPanel.svelte";
  import SpawnModal from "$lib/components/session/SpawnModal.svelte";
  import type { AgentNode, AgentType, AgentNodeConfig, SpawnRequest } from "$lib/types/session";
  import type { ChatMsg } from "$lib/components/session/ChatView.svelte";
  import { createNodeClient, type DOMessage, type ConnectionState } from "$lib/agents/node-client";
  import { page } from "$app/state";
  import { DEFAULT_MODEL } from "$lib/config";
  
  // ─── Server data ───
  let { data } = $props();
  const sessionId = $derived(page.params.id ?? "");


  // ─── Spawn modal ───
  let showSpawn = $state(false);
  let treeExpanded = $state(true);
  let containerRef: HTMLDivElement;

  onMount(() => {
    const el = containerRef;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (w > 0 && w < 520 && treeExpanded) treeExpanded = false;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  // ─── WebSocket state ───
  let workerUrl = $state<string | null>(null);
  let activeClients = $state<Record<string, ReturnType<typeof createNodeClient>>>({});
  let connectionStates = $state<Record<string, ConnectionState>>({});

  // Determine WebSocket URL: dev = localhost:8787, prod = from config
  onMount(async () => {
    if (dev) {
      // Dev mode: wrangler dev runs on port 8787
      workerUrl = 'http://localhost:8787';
      console.log('[Session] Dev mode - using worker at', workerUrl);
    } else {
      // Production: fetch from config endpoint
      try {
        const res = await fetch('/api/config');
        const cfg = await res.json() as { workerUrl: string };
        workerUrl = cfg.workerUrl;
        console.log('[Session] Production - using worker at', workerUrl);
      } catch (err) {
        console.error('[Session] Failed to fetch config:', err);
      }
    }
  });

  // Clean up all WS connections on destroy
  onDestroy(() => {
    for (const client of Object.values(activeClients)) {
      client.close();
    }
  });

  /** Connect to a node's ChatAgent DO if not already connected */
  function ensureConnection(nodeId: string) {
    if (!workerUrl || activeClients[nodeId]) return;

    const client = createNodeClient(workerUrl, nodeId, {
      onMessage: (msg: DOMessage) => handleDOMessage(nodeId, msg),
      onStateChange: (state: ConnectionState) => {
        connectionStates = { ...connectionStates, [nodeId]: state };
      },
    });

    activeClients = { ...activeClients, [nodeId]: client };
  }

  /** Handle messages from the ChatAgent DO */
  function handleDOMessage(nodeId: string, msg: DOMessage) {
    // History: full message log from DO SQLite (sent on connect)
    if (msg.type === 'history' && msg.messages) {
      const chatMsgs: ChatMsg[] = msg.messages.map(m => ({
        from: m.role === 'user' ? 'u' as const : 'a' as const,
        event: { type: 'text' as const, content: m.content },
      }));
      messagesByNode = { ...messagesByNode, [nodeId]: chatMsgs };
      return;
    }

    if (msg.type === 'event' && msg.event) {
      // Skip status events from being added as chat messages
      if (msg.event.type === 'status') {
        // Update node status
        if (rootNode) {
          const node = findNode(rootNode, nodeId);
          if (node) {
            node.status = msg.event.state as AgentNode['status'];
            rootNode = rootNode;
          }
        }
        return;
      }

      // For text events broadcast to other clients, avoid duplicates
      // (sender already added the user message locally)
      if (msg.role === 'user') {
        // This is a user message from another tab — add it
      }

      const existing = messagesByNode[nodeId] ?? [];
      messagesByNode = {
        ...messagesByNode,
        [nodeId]: [...existing, { from: msg.role === 'user' ? 'u' : 'a', event: msg.event }],
      };

      // Handle done events
      if (msg.event.type === 'done' && rootNode) {
        const node = findNode(rootNode, nodeId);
        if (node) {
          node.status = 'done';
          rootNode = rootNode;
        }
      }
    } else if (msg.type === 'tree_update' && msg.action === 'spawn' && msg.node) {
      // New child node spawned by the agent
      const n = msg.node as Record<string, string>;
      const newChild: AgentNode = {
        id: n.id ?? '',
        sessionId: n.sessionId ?? sessionId,
        parentId: n.parentId ?? nodeId,
        name: n.name ?? 'agent',
        agentType: (n.agentType ?? 'shelley') as AgentType,
        model: n.model ?? DEFAULT_MODEL,
        status: 'idle',
        config: {},
        sortOrder: 0,
        tokens: 0,
        children: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (rootNode) {
        const parent = findNode(rootNode, nodeId);
        if (parent) {
          parent.children = [...parent.children, newChild];
          rootNode = rootNode; // trigger reactivity
        }
      }
    } else if (msg.type === 'error') {
      console.error(`[ChatAgent ${nodeId}] Error:`, msg.message);
      // Show error as a system message in chat
      const existing = messagesByNode[nodeId] ?? [];
      messagesByNode = {
        ...messagesByNode,
						[nodeId]: [...existing, { from: 'a', event: { type: 'text', content: `Warning: ${msg.message}` } }],
      };
    }
  }

  // ─── Build tree from flat nodes ───
  function buildTree(flatNodes: typeof data.nodes): AgentNode | null {
    if (flatNodes.length === 0) return null;

    const nodeMap = new Map<string, AgentNode>();
    for (const n of flatNodes) {
      let config: AgentNodeConfig = {};
      try {
        config = typeof n.config === "string" ? JSON.parse(n.config) : (n.config ?? {});
      } catch { /* invalid JSON, default to {} */ }

      nodeMap.set(n.id, {
        id: n.id,
        sessionId: n.sessionId,
        parentId: n.parentId,
        name: n.name,
        agentType: n.agentType as AgentType,
        model: n.model,
        status: (n.status as AgentNode["status"]) ?? "idle",
        config,
        containerId: n.containerId ?? undefined,
        sortOrder: n.sortOrder ?? 0,
        tokens: n.tokens ?? 0,
        children: [],
        createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
        updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : Date.now(),
      });
    }

    const roots: AgentNode[] = [];
    for (const node of nodeMap.values()) {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots[0] ?? null;
  }

  let rootNode = $state<AgentNode | null>(buildTree(data.nodes));

  // ─── Messages (live from WebSocket) ───
  let messagesByNode = $state<Record<string, ChatMsg[]>>({});

  // ─── State ───
  let selectedId = $state<string | null>(rootNode?.id ?? null);

  // Auto-connect when selecting a node
  $effect(() => {
    if (selectedId && workerUrl) {
      ensureConnection(selectedId);
    }
  });

  /** Find a node by ID in the tree */
  function findNode(node: AgentNode, id: string): AgentNode | null {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  }

  /** Find a node by name in the tree */
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

  let currentConnectionState = $derived<ConnectionState | undefined>(
    selectedAgent ? connectionStates[selectedAgent.id] : undefined,
  );

  function handleSelect(id: string) {
    selectedId = id;
  }

  function handleNavigate(name: string) {
    if (!rootNode) return;
    const node = findByName(rootNode, name);
    if (node) selectedId = node.id;
  }

  function handleSend(message: string) {
    if (!selectedAgent) return;
    const nodeId = selectedAgent.id;

    // Check connection state first
    const connState = connectionStates[nodeId];
    if (connState && connState !== 'open') {
      // Show error in chat - not connected
      const msgs = messagesByNode[nodeId] ?? [];
      messagesByNode = {
        ...messagesByNode,
        [nodeId]: [...msgs, { from: 'a', event: { type: 'text', content: `⚠️ Cannot send: WebSocket ${connState}` } }],
      };
      return;
    }

    // Add user message to local state immediately
    const msgs = messagesByNode[nodeId] ?? [];
    messagesByNode = {
      ...messagesByNode,
      [nodeId]: [...msgs, { from: 'u', event: { type: 'text', content: message } }],
    };

    // Ensure connected then send via WebSocket
    ensureConnection(nodeId);
    const client = activeClients[nodeId];
    if (client) {
      try {
        client.send(message);
      } catch (err) {
        // Show error in chat if send fails
        const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
        messagesByNode = {
          ...messagesByNode,
          [nodeId]: [...messagesByNode[nodeId], { from: 'a', event: { type: 'text', content: `⚠️ Error: ${errorMsg}` } }],
        };
      }
    } else {
      // Client not ready - show waiting state
      messagesByNode = {
        ...messagesByNode,
        [nodeId]: [...messagesByNode[nodeId], { from: 'a', event: { type: 'text', content: '⏳ Connecting to agent...' } }],
      };
    }
  }

  async function handleSpawn(req: SpawnRequest) {
    if (!sessionId) return;
    const parentId = selectedAgent?.id ?? rootNode?.id;

    const res = await fetch(`/api/sessions/${sessionId}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: req.name,
        agentType: req.agentType,
        model: req.model,
        parentId,
        apiKey: req.apiKey,
      }),
    });

    if (!res.ok) {
      console.error("Failed to spawn node:", await res.text());
      showSpawn = false;
      return;
    }

    const spawnResult = (await res.json()) as { id: string };
    const newId = spawnResult.id;

    const newNode: AgentNode = {
      id: newId,
      name: req.name,
      agentType: req.agentType,
      model: req.model,
      status: "idle",
      children: [],
      sessionId,
      parentId: parentId ?? null,
      config: {},
      sortOrder: 0,
      tokens: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Add to parent's children in the tree
    if (rootNode && parentId) {
      const parent = findNode(rootNode, parentId);
      if (parent) {
        parent.children = [...parent.children, newNode];
      }
    } else if (!rootNode) {
      // First node becomes root
      rootNode = newNode;
    }

    showSpawn = false;
    selectedId = newId;
  }
</script>

<div class="session-root flex flex-col flex-1 h-[calc(100vh-48px)] overflow-hidden bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300" bind:this={containerRef}>
  <div class="session-container @container flex flex-1 h-full overflow-hidden">
    {#if rootNode}
      <AgentTree
        root={rootNode}
        {selectedId}
        expanded={treeExpanded}
        ontoggle={() => { treeExpanded = !treeExpanded; }}
        onselect={handleSelect}
        onspawn={() => { showSpawn = true; }}
      />

      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AgentPanel
          agent={selectedAgent}
          messages={currentMessages}
          onsend={handleSend}
          onnavigate={handleNavigate}
          ontogglesidebar={() => { treeExpanded = !treeExpanded; }}
          showSidebarToggle={!treeExpanded}
        />
      </div>
    {:else}
      <!-- Empty session -- prompt to spawn first agent -->
      <div class="flex-1 flex flex-col items-center justify-center gap-4 pt-8 bg-gray-50 dark:bg-neutral-950">
        <p class="text-sm text-gray-600 dark:text-neutral-300">{data.session.name}</p>
        <p class="text-xs text-gray-500 dark:text-neutral-500">No agents yet. Spawn your first agent to get started.</p>
        <button
          onclick={() => { showSpawn = true; }}
          class="px-5 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer bg-blue-600 hover:bg-blue-500 text-white dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          + spawn agent
        </button>
      </div>
    {/if}
  </div>
</div>

{#if showSpawn}
  <SpawnModal
    onclose={() => { showSpawn = false; }}
    onspawn={handleSpawn}
    accountKeyMasked={data.accountKeyMasked}
  />
{/if}
