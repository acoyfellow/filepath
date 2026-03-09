<script lang="ts">
  import "$lib/styles/theme.css";
  import AgentTree from "$lib/components/session/AgentTree.svelte";
  import AgentPanel from "$lib/components/session/AgentPanel.svelte";
  import type { AgentNode } from "$lib/types/session";
  import type { ChatMsg } from "$lib/components/session/ChatView.svelte";

  const rootSeed: AgentNode = {
    id: "root",
    sessionId: "demo-session",
    parentId: null,
    name: "Launch Loop",
    harnessId: "custom",
    model: "openai/gpt-5",
    status: "running",
    config: {},
    sortOrder: 0,
    tokens: 0,
    containerId: "root",
    children: [
      {
        id: "app-shell",
        sessionId: "demo-session",
        parentId: "root",
        name: "codex / app shell",
        harnessId: "codex",
        model: "openai/gpt-5",
        status: "running",
        config: {},
        sortOrder: 1,
        tokens: 18234,
        containerId: "app-shell",
        children: [
          {
            id: "release-check",
            sessionId: "demo-session",
            parentId: "app-shell",
            name: "custom / release check",
            harnessId: "custom",
            model: "openai/gpt-5",
            status: "done",
            config: {},
            sortOrder: 0,
            tokens: 4201,
            containerId: "release-check",
            children: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: "api-pass",
        sessionId: "demo-session",
        parentId: "root",
        name: "shelley / API pass",
        harnessId: "shelley",
        model: "openai/gpt-5",
        status: "idle",
        config: {},
        sortOrder: 2,
        tokens: 9412,
        containerId: "api-pass",
        children: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const seededMessages: Record<string, ChatMsg[]> = {
    root: [
      { from: "u", event: { type: "text", content: "Keep this launch loop running while I step away." } },
      {
        from: "a",
        event: {
          type: "workers",
          workers: [
            { name: "codex / app shell", status: "running" },
            { name: "shelley / API pass", status: "idle" },
            { name: "custom / release check", status: "done" },
          ],
        },
      },
      {
        from: "a",
        event: {
          type: "text",
          content: "Done. The same session stays live on your Cloudflare infra, and each agent keeps its own context.",
        },
      },
    ],
    "app-shell": [
      { from: "u", event: { type: "text", content: "Rewrite the hero and tighten the product copy." } },
      {
        from: "a",
        event: {
          type: "text",
          content: "Working on the app shell now. You can swap models later without losing this agent.",
        },
      },
    ],
    "api-pass": [
      { from: "u", event: { type: "text", content: "Validate the account key flow and router handling." } },
      {
        from: "a",
        event: {
          type: "text",
          content: "Queued here. This agent is idle until you send more work, but it stays in the same session tree.",
        },
      },
    ],
    "release-check": [
      { from: "u", event: { type: "text", content: "Do a final release check before I share it." } },
      {
        from: "a",
        event: {
          type: "text",
          content: "Release check is done. This agent is preserved in the same session.",
        },
      },
    ],
  };

  let rootNode = $state<AgentNode>(structuredClone(rootSeed));
  let selectedId = $state<string | null>("app-shell");
  let messagesByNode = $state<Record<string, ChatMsg[]>>(structuredClone(seededMessages));

  function findNode(node: AgentNode, id: string): AgentNode | null {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  }

  let selectedAgent = $derived(selectedId ? findNode(rootNode, selectedId) : null);
  let currentMessages = $derived<ChatMsg[]>(selectedAgent ? (messagesByNode[selectedAgent.id] ?? []) : []);

  function handleSelect(id: string) {
    selectedId = id;
  }

  function handleNavigate(name: string) {
    const byName = [rootNode, ...rootNode.children].find((node) => node.name === name);
    if (byName) {
      selectedId = byName.id;
    }
  }

  function handleSend(message: string) {
    if (!selectedAgent) return;
    const nodeId = selectedAgent.id;
    messagesByNode = {
      ...messagesByNode,
      [nodeId]: [
        ...(messagesByNode[nodeId] ?? []),
        { from: "u", event: { type: "text", content: message } },
        {
          from: "a",
          event: {
            type: "text",
            content: "Still live. This exact agent will be here when you reopen the session from another device.",
          },
        },
      ],
    };
  }

  function handleSpawn() {}
  async function handleMove() {}
  async function handleRename() {}
  async function handleDelete() {}
</script>

<div class="demo-shell">
  <div class="demo-topbar">
    <div class="demo-session">
      <div class="demo-name">demo / launch-loop</div>
      <div class="demo-meta">Long-running session on your Cloudflare infra</div>
    </div>
    <div class="demo-actions">
      <span class="demo-pill">running</span>
      <span class="demo-pill">4 agents</span>
      <button type="button" class="demo-btn">Reopen</button>
    </div>
  </div>

  <div class="demo-main">
    <AgentTree
      root={rootNode}
      {selectedId}
      width={300}
      onselect={handleSelect}
      onmove={handleMove}
      onrename={handleRename}
      ondelete={handleDelete}
      onspawn={handleSpawn}
    />
    <div class="demo-panel">
      <AgentPanel
        agent={selectedAgent}
        messages={currentMessages}
        onsend={handleSend}
        onnavigate={handleNavigate}
      />
    </div>
  </div>
</div>

<style>
  .demo-shell {
    display: flex;
    flex-direction: column;
    min-height: 560px;
    background: var(--bg);
    color: var(--t1);
  }

  .demo-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--b1);
    background: color-mix(in srgb, var(--top-bg) 78%, transparent);
    backdrop-filter: blur(10px);
  }

  .demo-session {
    min-width: 0;
  }

  .demo-name {
    font-family: var(--m);
    font-size: 13px;
    font-weight: 600;
    color: var(--t1);
  }

  .demo-meta {
    margin-top: 2px;
    font-family: var(--m);
    font-size: 11px;
    color: var(--t5);
  }

  .demo-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .demo-pill {
    font-family: var(--m);
    font-size: 10px;
    color: var(--t3);
    border: 1px solid var(--b1);
    background: var(--bg2);
    border-radius: 999px;
    padding: 4px 8px;
  }

  .demo-btn {
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    background: color-mix(in srgb, var(--accent) 12%, var(--bg));
    color: var(--t2);
    border-radius: 999px;
    padding: 6px 12px;
    font-family: var(--m);
    font-size: 11px;
    cursor: pointer;
  }

  .demo-main {
    display: flex;
    min-height: 0;
    flex: 1;
  }

  .demo-panel {
    min-width: 0;
    flex: 1;
  }
</style>
