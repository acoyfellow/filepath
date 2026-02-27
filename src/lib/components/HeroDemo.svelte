<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import type { AgentStatus } from "$lib/protocol";
  import { onDestroy } from "svelte";

  type DemoMsg = { role: "user" | "agent"; content: string; showTools?: boolean };

  // Per-agent initial messages
  const initialMessagesByNode: Record<string, DemoMsg[]> = {
    "1": [
      { role: "user", content: "Build an API client with tests" },
      { role: "agent", content: "I'll coordinate this. Spawning a researcher and test writer to work in parallel.", showTools: true },
    ],
    "2": [
      { role: "user", content: "Research best practices for REST clients" },
      { role: "agent", content: "Researching best practices for REST client design..." },
    ],
    "3": [
      { role: "user", content: "Write unit tests for the API client" },
      { role: "agent", content: "Writing unit tests for the API client module..." },
    ],
    "4": [
      { role: "user", content: "Cover edge cases" },
      { role: "agent", content: "Focusing on edge cases: timeouts, retries, invalid responses." },
    ],
  };

  let selectedId = $state("1");
  let messagesByNode = $state<Record<string, DemoMsg[]>>(structuredClone(initialMessagesByNode));
  let demoTree = $state([
    { id: "1", name: "Project Manager", status: "running" as AgentStatus, depth: 0, hasChildren: true },
    { id: "2", name: "API Research", status: "running" as AgentStatus, depth: 1, hasChildren: false },
    { id: "3", name: "Write Tests", status: "idle" as AgentStatus, depth: 1, hasChildren: true },
    { id: "4", name: "Edge Cases", status: "done" as AgentStatus, depth: 2, hasChildren: false },
  ]);

  let selectedNode = $derived(demoTree.find((n) => n.id === selectedId));
  let currentMessages = $derived(messagesByNode[selectedId] ?? []);
  let isSending = $state(false);
  let mobileTab = $state<"tree" | "chat">("tree");
  let inputValue = $state("");

  function selectNode(id: string) {
    selectedId = id;
  }

  function handleSend() {
    const val = inputValue.trim();
    if (!val || isSending) return;
    const msgs = messagesByNode[selectedId] ?? [];
    messagesByNode = { ...messagesByNode, [selectedId]: [...msgs, { role: "user", content: val }] };
    inputValue = "";
    isSending = true;
    const agentResponse = selectedId === "1"
      ? { role: "agent" as const, content: "Got it. I'll delegate to the team.", showTools: false }
      : { role: "agent" as const, content: "Understood. Continuing work.", showTools: false };
    setTimeout(() => {
      messagesByNode = {
        ...messagesByNode,
        [selectedId]: [...(messagesByNode[selectedId] ?? []), agentResponse],
      };
      isSending = false;
    }, 1500);
  }

  function handleSpawn() {
    const nextId = String(demoTree.length + 1);
    demoTree = [
      ...demoTree,
      { id: nextId, name: "Review", status: "idle" as AgentStatus, depth: 1, hasChildren: false },
    ];
    messagesByNode = { ...messagesByNode, [nextId]: [] };
  }


  onDestroy(() => {
    // Cleanup if needed
  });

</script>

<div class="w-full min-w-0 rounded-lg overflow-hidden border bg-gray-100 dark:bg-neutral-900/50 border-gray-200 dark:border-neutral-800">
  <!-- Side-by-side when container is wide enough; tabs when narrow -->
  <div class="hidden @md:grid @md:grid-cols-[200px_1fr] @lg:grid-cols-[240px_1fr] min-h-[360px]">
    <!-- Left: Tree Panel -->
    <div class="border-r p-4 border-gray-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/30">
      <div class="flex items-center justify-between mb-4">
        <span class="text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Agents</span>
        <span class="text-xs text-gray-400 dark:text-neutral-600">{demoTree.length} active</span>
      </div>
      
      <div class="space-y-1">
        {#each demoTree as node}
          <button
            type="button"
            class="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors {node.id === selectedId ? 'bg-gray-200 dark:bg-neutral-800/50' : 'hover:bg-gray-100 dark:hover:bg-neutral-800/30'}"
            style="padding-left: {node.depth * 16 + 8}px"
            onclick={() => selectNode(node.id)}
          >
            {#if node.hasChildren}
              <span class="text-xs text-gray-400 dark:text-neutral-600">v</span>
            {:else}
              <span class="w-3"></span>
            {/if}
            <StatusDot status={node.status} size={6} />
            <span class="text-sm {node.id === selectedId ? 'text-gray-900 dark:text-neutral-200' : 'text-gray-600 dark:text-neutral-400'}">{node.name}</span>
          </button>
        {/each}
      </div>
      
      <div class="mt-6 pt-4 border-t border-gray-200 dark:border-neutral-800">
        <button
          type="button"
          class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm transition-colors bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300"
          onclick={handleSpawn}
        >
          <span>+</span>
          <span>Spawn Agent</span>
        </button>
      </div>
    </div>
    
    <!-- Right: Chat Panel -->
    <div class="flex flex-col bg-white dark:bg-neutral-950">
      {#if selectedNode}
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/20">
          <div class="flex items-center gap-2">
            <StatusDot status={selectedNode.status} size={6} />
            <span class="text-sm text-gray-900 dark:text-neutral-200">{selectedNode.name}</span>
          </div>
          <span class="text-xs text-gray-400 dark:text-neutral-600">claude-sonnet-4</span>
        </div>
        
        <!-- Messages -->
        <div class="flex-1 p-4 space-y-4 overflow-y-auto min-h-[200px]">
          {#each currentMessages as msg}
            <div class="flex gap-3">
              <div class="w-6 h-6 rounded flex items-center justify-center text-xs shrink-0 bg-gray-200 dark:bg-neutral-800">
                {msg.role === 'user' ? 'U' : 'A'}
              </div>
              <div class="flex-1">
                <p class="text-sm text-gray-700 dark:text-neutral-300">{msg.content}</p>
                {#if msg.showTools}
                  <div class="mt-2 space-y-1.5">
                    <div class="flex items-center gap-2 text-xs rounded px-2 py-1.5 text-gray-500 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-900/50">
                      <span class="text-green-600 dark:text-green-500/60">+</span>
                      <span>Spawned Researcher (pi)</span>
                    </div>
                    <div class="flex items-center gap-2 text-xs rounded px-2 py-1.5 text-gray-500 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-900/50">
                      <span class="text-green-600 dark:text-green-500/60">+</span>
                      <span>Spawned Test Writer (shelley)</span>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
          {#if isSending}
            <div class="flex gap-3">
              <div class="w-6 h-6 rounded flex items-center justify-center text-xs shrink-0 bg-gray-200 dark:bg-neutral-800">A</div>
              <div class="flex items-center gap-1 py-2">
                <span class="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-neutral-500 animate-pulse"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-neutral-500 animate-pulse" style="animation-delay: 0.15s"></span>
                <span class="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-neutral-500 animate-pulse" style="animation-delay: 0.3s"></span>
              </div>
            </div>
          {/if}
        </div>
        
        <!-- Input -->
        <div class="p-3 border-t border-gray-200 dark:border-neutral-800">
          <div class="flex gap-2">
            <input 
              type="text" 
              placeholder="Message..." 
              class="hero-demo-input flex-1 rounded px-3 py-2 text-sm focus:outline-none bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-700 dark:text-neutral-300 placeholder:text-gray-400 dark:placeholder:text-neutral-600 focus:border-gray-300 dark:focus:border-neutral-700"
              bind:value={inputValue}
              onkeydown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isSending}
            />
            <button
              type="button"
              class="px-3 py-2 rounded text-sm transition-colors disabled:opacity-50 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300"
              onclick={handleSend}
              disabled={isSending}
            >
              Send
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Tabs layout when container is narrow -->
  <div class="@md:hidden min-h-[320px]">
    <div class="flex border-b border-gray-200 dark:border-neutral-800">
      <button
        type="button"
        class="flex-1 text-xs py-2 {mobileTab === 'tree' ? 'border-b-2 border-gray-600 text-gray-900 dark:border-neutral-400 dark:text-neutral-200' : 'text-gray-500 dark:text-neutral-500'}"
        onclick={() => mobileTab = 'tree'}
      >Tree</button>
      <button
        type="button"
        class="flex-1 text-xs py-2 {mobileTab === 'chat' ? 'border-b-2 border-gray-600 text-gray-900 dark:border-neutral-400 dark:text-neutral-200' : 'text-gray-500 dark:text-neutral-500'}"
        onclick={() => mobileTab = 'chat'}
      >Chat</button>
    </div>

    {#if mobileTab === 'tree'}
      <div class="p-3 bg-gray-100 dark:bg-neutral-900/30">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs uppercase tracking-wide text-gray-500 dark:text-neutral-500">Agents</span>
          <span class="text-xs text-gray-400 dark:text-neutral-600">{demoTree.length} active</span>
        </div>
        <div class="space-y-1">
          {#each demoTree as node}
            <button
              type="button"
              class="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded {node.id === selectedId ? 'bg-gray-200 dark:bg-neutral-800/50' : ''}"
              style="padding-left: {node.depth * 12 + 8}px"
              onclick={() => { selectNode(node.id); mobileTab = 'chat'; }}
            >
              <StatusDot status={node.status} size={5} />
              <span class="text-xs {node.id === selectedId ? 'text-gray-900 dark:text-neutral-200' : 'text-gray-600 dark:text-neutral-400'}">{node.name}</span>
            </button>
          {/each}
        </div>
        <button
          type="button"
          class="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm bg-gray-200 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300"
          onclick={handleSpawn}
        >
          <span>+</span> Spawn Agent
        </button>
      </div>
    {:else if selectedNode}
      <div class="flex flex-col bg-white dark:bg-neutral-950 min-h-[280px]" role="region" aria-label="Chat for {selectedNode.name}">
        <div class="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-neutral-800">
          <StatusDot status={selectedNode.status} size={5} />
          <span class="text-xs text-gray-900 dark:text-neutral-200">{selectedNode.name}</span>
        </div>
        <div class="flex-1 p-3 space-y-2 overflow-y-auto">
          {#each currentMessages as msg}
            <div>
              <p class="text-xs {msg.role === 'user' ? 'text-gray-500 dark:text-neutral-500' : 'text-gray-600 dark:text-neutral-400'}">
                {msg.role === 'user' ? 'User' : 'Agent'}: {msg.content}
              </p>
            </div>
          {/each}
          {#if isSending}
            <p class="text-xs text-gray-500 dark:text-neutral-500">Agent typing...</p>
          {/if}
          {#if currentMessages.length === 0}
            <p class="text-xs text-gray-500 dark:text-neutral-500">Send a message to get started</p>
          {/if}
        </div>
        <div class="p-3 border-t border-gray-200 dark:border-neutral-800">
          <div class="flex gap-2">
            <input
              type="text"
              placeholder="Message..."
              class="hero-demo-input flex-1 rounded px-3 py-2 text-sm bg-gray-50 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-800"
              bind:value={inputValue}
              onkeydown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isSending}
            />
            <button
              type="button"
              class="px-3 py-2 rounded text-sm disabled:opacity-50 bg-gray-200 text-gray-700 dark:bg-neutral-800 dark:text-neutral-300"
              onclick={handleSend}
              disabled={isSending}
            >Send</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
