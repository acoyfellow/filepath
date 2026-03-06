<script lang="ts">
  import "$lib/styles/theme.css";
  import AgentTree from "$lib/components/session/AgentTree.svelte";
  import AgentPanel from "$lib/components/session/AgentPanel.svelte";
  import type { AgentNode, ArtifactEntry } from "$lib/types/session";
  import type { ChatMsg } from "$lib/components/session/ChatView.svelte";

  const rootSeed: AgentNode = {
    id: "root",
    sessionId: "demo-session",
    parentId: null,
    name: "Launch Loop",
    agentType: "custom",
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
        agentType: "codex",
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
            agentType: "custom",
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
        agentType: "shelley",
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
      {
        from: "u",
        event: {
          type: "text",
          content: "Keep this launch loop running while I step away.",
        },
      },
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
          content:
            "Done. The same session stays live on your Cloudflare infra, and each thread keeps its own context.",
        },
      },
    ],
    "app-shell": [
      {
        from: "u",
        event: {
          type: "text",
          content: "Rewrite the hero and tighten the product copy.",
        },
      },
      {
        from: "a",
        event: {
          type: "text",
          content:
            "Working on the app shell now. You can swap models later without losing this thread.",
        },
      },
    ],
    "api-pass": [
      {
        from: "u",
        event: {
          type: "text",
          content: "Validate the account key flow and router handling.",
        },
      },
      {
        from: "a",
        event: {
          type: "text",
          content:
            "Queued here. This thread is idle until you send more work, but it stays in the same session tree.",
        },
      },
    ],
    "release-check": [
      {
        from: "u",
        event: {
          type: "text",
          content: "Do a final release check before I share it.",
        },
      },
      {
        from: "a",
        event: {
          type: "text",
          content:
            "Release check is done. This thread is preserved in the same session.",
        },
      },
    ],
  };

  const seededArtifacts: ArtifactEntry[] = [
    {
      id: "artifact-1",
      sessionId: "demo-session",
      sourceNodeId: "app-shell",
      targetNodeId: "release-check",
      sourcePath: "dist/hero-copy.txt",
      targetPath: "handoffs/release/hero-copy.txt",
      bucketKey: "sessions/demo-session/artifacts/app-shell/artifact-1",
      status: "delivered",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

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

  let selectedAgent = $derived(
    selectedId ? findNode(rootNode, selectedId) : null,
  );

  let currentMessages = $derived<ChatMsg[]>(
    selectedAgent ? (messagesByNode[selectedAgent.id] ?? []) : [],
  );
  let currentArtifacts = $derived<ArtifactEntry[]>(
    selectedAgent
      ? seededArtifacts.filter(
          (artifact) =>
            artifact.sourceNodeId === selectedAgent.id || artifact.targetNodeId === selectedAgent.id,
        )
      : [],
  );
  let threadChoices = $derived<Array<{ id: string; name: string }>>(
    [
      { id: "root", name: "Launch Loop" },
      { id: "app-shell", name: "codex / app shell" },
      { id: "release-check", name: "custom / release check" },
      { id: "api-pass", name: "shelley / API pass" },
    ],
  );

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
            content:
              "Still live. This exact thread will be here when you reopen the session from another device.",
          },
        },
      ],
    };
  }

  function handleSpawn() {
    // Homepage demo stays deterministic. Keep the same seeded structure.
  }

  async function handleMove() {
    // Homepage demo stays deterministic. Keep the same seeded structure.
  }

  async function handleSendArtifact() {
    // Homepage demo stays deterministic. Keep the same seeded structure.
  }
</script>

<div class="demo-shell">
  <div class="demo-topbar">
    <div class="demo-session">
      <div class="demo-name">demo / launch-loop</div>
      <div class="demo-meta">Long-running session on your Cloudflare infra</div>
    </div>
    <div class="demo-actions">
      <span class="demo-pill">running</span>
      <span class="demo-pill">4 threads</span>
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
      onspawn={handleSpawn}
    />
    <div class="demo-panel">
      <AgentPanel
        agent={selectedAgent}
        messages={currentMessages}
        onsend={handleSend}
        onnavigate={handleNavigate}
        artifacts={currentArtifacts}
        threads={threadChoices}
        onsendartifact={handleSendArtifact}
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

  .demo-pill,
  .demo-btn {
    font-family: var(--m);
    font-size: 10px;
    color: var(--t4);
    border: 1px solid var(--b1);
    border-radius: 999px;
    padding: 4px 10px;
    background: color-mix(in srgb, var(--bg2) 88%, transparent);
  }

  .demo-btn {
    cursor: pointer;
    transition: border-color 0.1s, color 0.1s;
  }

  .demo-btn:hover {
    border-color: var(--t5);
    color: var(--t2);
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

  :global(.demo-panel .panel-header) {
    padding: 10px 16px;
  }

  :global(.demo-panel .panel-body) {
    min-height: 0;
  }

  @media (max-width: 900px) {
    .demo-shell {
      min-height: 720px;
    }

    .demo-topbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .demo-actions {
      justify-content: flex-start;
    }

    .demo-main {
      flex-direction: column;
    }

    :global(.demo-main .tree-container) {
      width: 100%;
    }

    :global(.demo-main .tree) {
      width: 100% !important;
      border-right: none;
      border-bottom: 1px solid var(--b1);
    }

    :global(.demo-main .resize-handle) {
      display: none;
    }

    .demo-panel {
      min-height: 360px;
    }
  }
</style>
