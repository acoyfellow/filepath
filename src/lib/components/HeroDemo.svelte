<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import type { AgentStatus } from "$lib/protocol";
  import { onDestroy } from "svelte";

  interface Props {
    dark?: boolean;
  }

  let { dark = true }: Props = $props();

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
  let autoPlayTimers: ReturnType<typeof setTimeout>[] = [];
  let mode = $state<"try" | "watch">("try");
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

  function startAutoPlay() {
    stopAutoPlay();
    mode = "watch";
    selectNode("1");
    autoPlayTimers.push(setTimeout(() => selectNode("2"), 2500));
    autoPlayTimers.push(setTimeout(() => {
      demoTree = demoTree.map((n) => (n.id === "2" ? { ...n, status: "done" as AgentStatus } : n));
    }, 3500));
    autoPlayTimers.push(setTimeout(() => selectNode("3"), 5000));
    autoPlayTimers.push(setTimeout(() => {
      demoTree = demoTree.map((n) => (n.id === "3" ? { ...n, status: "done" as AgentStatus } : n));
    }, 6000));
    autoPlayTimers.push(setTimeout(() => selectNode("4"), 7500));
    autoPlayTimers.push(setTimeout(() => selectNode("1"), 10000));
    autoPlayTimers.push(setTimeout(() => { mode = "try"; }, 12500));
  }

  function stopAutoPlay() {
    for (const t of autoPlayTimers) clearTimeout(t);
    autoPlayTimers = [];
    mode = "try";
  }

  onDestroy(() => {
    for (const t of autoPlayTimers) clearTimeout(t);
  });
</script>

<div class="w-full min-w-0 rounded-lg overflow-hidden border {dark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-gray-100 border-gray-200'}">
  <!-- Mode toggle -->
  <div class="flex gap-2 p-3 border-b {dark ? 'border-neutral-800' : 'border-gray-200'}">
    <button
      type="button"
      class="text-xs px-2 py-1 rounded {mode === 'try' ? (dark ? 'bg-neutral-800 text-neutral-200' : 'bg-gray-200 text-gray-900') : (dark ? 'text-neutral-500 hover:text-neutral-300' : 'text-gray-500 hover:text-gray-700')}"
      onclick={() => stopAutoPlay()}
    >Try it</button>
    <button
      type="button"
      class="text-xs px-2 py-1 rounded {mode === 'watch' ? (dark ? 'bg-neutral-800 text-neutral-200' : 'bg-gray-200 text-gray-900') : (dark ? 'text-neutral-500 hover:text-neutral-300' : 'text-gray-500 hover:text-gray-700')}"
      onclick={() => startAutoPlay()}
    >Watch demo</button>
  </div>

  <!-- Side-by-side when container is wide enough; tabs when narrow -->
  <div class="hidden @md:grid @md:grid-cols-[200px_1fr] @lg:grid-cols-[240px_1fr] min-h-[360px]">
    <!-- Left: Tree Panel -->
    <div class="border-r p-4 {dark ? 'border-neutral-800 bg-neutral-900/30' : 'border-gray-200 bg-white/50'}">
      <div class="flex items-center justify-between mb-4">
        <span class="text-xs uppercase tracking-wide {dark ? 'text-neutral-500' : 'text-gray-500'}">Agents</span>
        <span class="text-xs {dark ? 'text-neutral-600' : 'text-gray-400'}">{demoTree.length} active</span>
      </div>
      
      <div class="space-y-1">
        {#each demoTree as node}
          <button
            type="button"
            class="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors {node.id === selectedId ? (dark ? 'bg-neutral-800/50' : 'bg-gray-200') : (dark ? 'hover:bg-neutral-800/30' : 'hover:bg-gray-100')}"
            style="padding-left: {node.depth * 16 + 8}px"
            onclick={() => selectNode(node.id)}
          >
            {#if node.hasChildren}
              <span class="text-xs {dark ? 'text-neutral-600' : 'text-gray-400'}">v</span>
            {:else}
              <span class="w-3"></span>
            {/if}
            <StatusDot status={node.status} size={6} />
            <span class="text-sm {node.id === selectedId ? (dark ? 'text-neutral-200' : 'text-gray-900') : (dark ? 'text-neutral-400' : 'text-gray-600')}">{node.name}</span>
          </button>
        {/each}
      </div>
      
      <div class="mt-6 pt-4 {dark ? 'border-t border-neutral-800' : 'border-t border-gray-200'}">
        <button
          type="button"
          class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm transition-colors {dark ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}"
          onclick={handleSpawn}
        >
          <span>+</span>
          <span>Spawn Agent</span>
        </button>
      </div>
    </div>
    
    <!-- Right: Chat Panel -->
    <div class="flex flex-col {dark ? 'bg-neutral-950' : 'bg-white'}">
      {#if selectedNode}
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b {dark ? 'border-neutral-800 bg-neutral-900/20' : 'border-gray-200 bg-gray-50'}">
          <div class="flex items-center gap-2">
            <StatusDot status={selectedNode.status} size={6} />
            <span class="text-sm {dark ? 'text-neutral-200' : 'text-gray-900'}">{selectedNode.name}</span>
          </div>
          <span class="text-xs {dark ? 'text-neutral-600' : 'text-gray-400'}">claude-sonnet-4</span>
        </div>
        
        <!-- Messages -->
        <div class="flex-1 p-4 space-y-4 overflow-y-auto min-h-[200px]">
          {#each currentMessages as msg}
            <div class="flex gap-3">
              <div class="w-6 h-6 rounded flex items-center justify-center text-xs shrink-0 {dark ? 'bg-neutral-800' : 'bg-gray-200'}">
                {msg.role === 'user' ? 'U' : 'A'}
              </div>
              <div class="flex-1">
                <p class="text-sm {dark ? 'text-neutral-300' : 'text-gray-700'}">{msg.content}</p>
                {#if msg.showTools}
                  <div class="mt-2 space-y-1.5">
                    <div class="flex items-center gap-2 text-xs rounded px-2 py-1.5 {dark ? 'text-neutral-500 bg-neutral-900/50' : 'text-gray-500 bg-gray-100'}">
                      <span class="{dark ? 'text-green-500/60' : 'text-green-600'}">+</span>
                      <span>Spawned Researcher (pi)</span>
                    </div>
                    <div class="flex items-center gap-2 text-xs rounded px-2 py-1.5 {dark ? 'text-neutral-500 bg-neutral-900/50' : 'text-gray-500 bg-gray-100'}">
                      <span class="{dark ? 'text-green-500/60' : 'text-green-600'}">+</span>
                      <span>Spawned Test Writer (shelley)</span>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
          {#if isSending}
            <div class="flex gap-3">
              <div class="w-6 h-6 rounded flex items-center justify-center text-xs shrink-0 {dark ? 'bg-neutral-800' : 'bg-gray-200'}">A</div>
              <div class="flex items-center gap-1 py-2">
                <span class="w-1.5 h-1.5 rounded-full {dark ? 'bg-neutral-500' : 'bg-gray-400'} animate-pulse"></span>
                <span class="w-1.5 h-1.5 rounded-full {dark ? 'bg-neutral-500' : 'bg-gray-400'} animate-pulse" style="animation-delay: 0.15s"></span>
                <span class="w-1.5 h-1.5 rounded-full {dark ? 'bg-neutral-500' : 'bg-gray-400'} animate-pulse" style="animation-delay: 0.3s"></span>
              </div>
            </div>
          {/if}
        </div>
        
        <!-- Input -->
        <div class="p-3 border-t {dark ? 'border-neutral-800' : 'border-gray-200'}">
          <div class="flex gap-2">
            <input 
              type="text" 
              placeholder="Message..." 
              class="hero-demo-input flex-1 rounded px-3 py-2 text-sm focus:outline-none {dark ? 'bg-neutral-900 border-neutral-800 text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-700' : 'bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-gray-300 border'}"
              bind:value={inputValue}
              onkeydown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isSending}
            />
            <button
              type="button"
              class="px-3 py-2 rounded text-sm transition-colors disabled:opacity-50 {dark ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}"
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
    <div class="flex border-b {dark ? 'border-neutral-800' : 'border-gray-200'}">
      <button
        type="button"
        class="flex-1 text-xs py-2 {mobileTab === 'tree' ? (dark ? 'border-b-2 border-neutral-400 text-neutral-200' : 'border-b-2 border-gray-600 text-gray-900') : (dark ? 'text-neutral-500' : 'text-gray-500')}"
        onclick={() => mobileTab = 'tree'}
      >Tree</button>
      <button
        type="button"
        class="flex-1 text-xs py-2 {mobileTab === 'chat' ? (dark ? 'border-b-2 border-neutral-400 text-neutral-200' : 'border-b-2 border-gray-600 text-gray-900') : (dark ? 'text-neutral-500' : 'text-gray-500')}"
        onclick={() => mobileTab = 'chat'}
      >Chat</button>
    </div>

    {#if mobileTab === 'tree'}
      <div class="p-3 {dark ? 'bg-neutral-900/30' : 'bg-gray-100'}">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs uppercase tracking-wide {dark ? 'text-neutral-500' : 'text-gray-500'}">Agents</span>
          <span class="text-xs {dark ? 'text-neutral-600' : 'text-gray-400'}">{demoTree.length} active</span>
        </div>
        <div class="space-y-1">
          {#each demoTree as node}
            <button
              type="button"
              class="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded {node.id === selectedId ? (dark ? 'bg-neutral-800/50' : 'bg-gray-200') : ''}"
              style="padding-left: {node.depth * 12 + 8}px"
              onclick={() => { selectNode(node.id); mobileTab = 'chat'; }}
            >
              <StatusDot status={node.status} size={5} />
              <span class="text-xs {node.id === selectedId ? (dark ? 'text-neutral-200' : 'text-gray-900') : (dark ? 'text-neutral-400' : 'text-gray-600')}">{node.name}</span>
            </button>
          {/each}
        </div>
        <button
          type="button"
          class="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm {dark ? 'bg-neutral-800 text-neutral-300' : 'bg-gray-200 text-gray-700'}"
          onclick={handleSpawn}
        >
          <span>+</span> Spawn Agent
        </button>
      </div>
    {:else if selectedNode}
      <div class="flex flex-col {dark ? 'bg-neutral-950' : 'bg-white'} min-h-[280px]" role="region" aria-label="Chat for {selectedNode.name}">
        <div class="flex items-center gap-2 p-3 border-b {dark ? 'border-neutral-800' : 'border-gray-200'}">
          <StatusDot status={selectedNode.status} size={5} />
          <span class="text-xs {dark ? 'text-neutral-200' : 'text-gray-900'}">{selectedNode.name}</span>
        </div>
        <div class="flex-1 p-3 space-y-2 overflow-y-auto">
          {#each currentMessages as msg}
            <div>
              <p class="text-xs {msg.role === 'user' ? (dark ? 'text-neutral-500' : 'text-gray-500') : (dark ? 'text-neutral-400' : 'text-gray-600')}">
                {msg.role === 'user' ? 'User' : 'Agent'}: {msg.content}
              </p>
            </div>
          {/each}
          {#if isSending}
            <p class="text-xs {dark ? 'text-neutral-500' : 'text-gray-500'}">Agent typing...</p>
          {/if}
          {#if currentMessages.length === 0}
            <p class="text-xs {dark ? 'text-neutral-500' : 'text-gray-500'}">Send a message to get started</p>
          {/if}
        </div>
        <div class="p-3 border-t {dark ? 'border-neutral-800' : 'border-gray-200'}">
          <div class="flex gap-2">
            <input
              type="text"
              placeholder="Message..."
              class="hero-demo-input flex-1 rounded px-3 py-2 text-sm {dark ? 'bg-neutral-900 text-neutral-300' : 'bg-gray-50 text-gray-700'} border {dark ? 'border-neutral-800' : 'border-gray-200'}"
              bind:value={inputValue}
              onkeydown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isSending}
            />
            <button
              type="button"
              class="px-3 py-2 rounded text-sm disabled:opacity-50 {dark ? 'bg-neutral-800 text-neutral-300' : 'bg-gray-200 text-gray-700'}"
              onclick={handleSend}
              disabled={isSending}
            >Send</button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
