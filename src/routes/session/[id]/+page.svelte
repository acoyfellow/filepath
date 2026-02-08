<script lang="ts">
  import "$lib/styles/theme.css";
  import TopBar from "$lib/components/session/TopBar.svelte";
  import AgentTree from "$lib/components/session/AgentTree.svelte";
  import AgentPanel from "$lib/components/session/AgentPanel.svelte";
  import SpawnModal from "$lib/components/session/SpawnModal.svelte";
  import type { AgentNode, AgentType, AgentNodeConfig } from "$lib/types/session";
  import type { ChatMsg } from "$lib/components/session/ChatView.svelte";
  import { page } from "$app/stores";

  // ─── Server data ───
  let { data } = $props();
  const sessionId = $derived($page.params.id);

  // ─── Theme ───
  let dark = $state(false);

  // ─── Spawn modal ───
  let showSpawn = $state(false);

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

  // ─── Messages (live from WebSocket, empty until connected) ───
  let messagesByNode = $state<Record<string, ChatMsg[]>>({});

  // ─── State ───
  let selectedId = $state<string | null>(rootNode?.id ?? null);

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
    // Add user message to local state
    const nodeId = selectedAgent.id;
    const msgs = messagesByNode[nodeId] ?? [];
    messagesByNode[nodeId] = [...msgs, { from: "u", event: { type: "text", content: message } }];
    // TODO: send to ChatAgent DO via WebSocket
  }

  async function handleSpawn(req: { name: string; agentType: AgentType; model: string }) {
    const parentId = selectedAgent?.id ?? rootNode?.id;

    const res = await fetch(`/api/sessions/${sessionId}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: req.name,
        agentType: req.agentType,
        model: req.model,
        parentId,
      }),
    });

    if (!res.ok) {
      console.error("Failed to spawn node:", await res.text());
      showSpawn = false;
      return;
    }

    const { id: newId } = await res.json();

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

<div class:dark style="display:flex;flex-direction:column;height:100vh;width:100vw;background:var(--bg);color:var(--t1);overflow:hidden">
  <TopBar {dark} ontoggletheme={() => { dark = !dark; }} />

  <div style="display:flex;flex:1;overflow:hidden">
    {#if rootNode}
      <AgentTree
        root={rootNode}
        {selectedId}
        onselect={handleSelect}
        onspawn={() => { showSpawn = true; }}
      />

      <div style="flex:1;display:flex;flex-direction:column;background:var(--bg);overflow:hidden">
        <AgentPanel
          agent={selectedAgent}
          messages={currentMessages}
          onsend={handleSend}
          onnavigate={handleNavigate}
        />
      </div>
    {:else}
      <!-- Empty session -- prompt to spawn first agent -->
      <div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px">
        <p style="color:var(--t2);font-size:14px">{data.session.name}</p>
        <p style="color:var(--t3);font-size:13px">No agents yet. Spawn your first agent to get started.</p>
        <button
          onclick={() => { showSpawn = true; }}
          style="padding:8px 20px;background:var(--accent);color:var(--bg);border:none;border-radius:6px;font-size:13px;cursor:pointer"
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
  />
{/if}
