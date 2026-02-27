<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import type { AgentStatus } from "$lib/protocol";

  interface Props {
    dark?: boolean;
  }

  let { dark = true }: Props = $props();

  // Demo data for the hero visualization
  const demoTree = [
    { id: "1", name: "Project Manager", status: "running" as AgentStatus, depth: 0, hasChildren: true },
    { id: "2", name: "API Research", status: "running" as AgentStatus, depth: 1, hasChildren: false },
    { id: "3", name: "Write Tests", status: "idle" as AgentStatus, depth: 1, hasChildren: true },
    { id: "4", name: "Edge Cases", status: "done" as AgentStatus, depth: 2, hasChildren: false },
  ];

  const demoMessages = [
    { role: "user", content: "Build an API client with tests" },
    { role: "agent", content: "I'll coordinate this. Spawning a researcher and test writer to work in parallel.", showTools: true },
  ];
</script>

<div class="w-full rounded-lg overflow-hidden border {dark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-gray-100 border-gray-200'}">
  <!-- Desktop Layout: Side by Side -->
  <div class="hidden md:grid md:grid-cols-[280px_1fr] min-h-[400px]">
    <!-- Left: Tree Panel -->
    <div class="border-r p-4 {dark ? 'border-neutral-800 bg-neutral-900/30' : 'border-gray-200 bg-white/50'}">
      <div class="flex items-center justify-between mb-4">
        <span class="text-xs uppercase tracking-wide {dark ? 'text-neutral-500' : 'text-gray-500'}">Agents</span>
        <span class="text-xs {dark ? 'text-neutral-600' : 'text-gray-400'}">4 active</span>
      </div>
      
      <div class="space-y-1">
        {#each demoTree as node}
          <div 
            class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors {node.id === '1' ? (dark ? 'bg-neutral-800/50' : 'bg-gray-200') : (dark ? 'hover:bg-neutral-800/30' : 'hover:bg-gray-100')}" style="padding-left: {node.depth * 16 + 8}px"
          >
            {#if node.hasChildren}
              <span class="text-xs {dark ? 'text-neutral-600' : 'text-gray-400'}">v</span>
            {:else}
              <span class="w-3"></span>
            {/if}
            <StatusDot status={node.status} size={6} />
            <span class="text-sm {node.id === '1' ? (dark ? 'text-neutral-200' : 'text-gray-900') : (dark ? 'text-neutral-400' : 'text-gray-600')}">{node.name}</span>
          </div>
        {/each}
      </div>
      
      <div class="mt-6 pt-4 {dark ? 'border-t border-neutral-800' : 'border-t border-gray-200'}">
        <button class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm transition-colors {dark ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}">
          <span>+</span>
          <span>Spawn Agent</span>
        </button>
      </div>
    </div>
    
    <!-- Right: Chat Panel -->
    <div class="flex flex-col {dark ? 'bg-neutral-950' : 'bg-white'}">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b {dark ? 'border-neutral-800 bg-neutral-900/20' : 'border-gray-200 bg-gray-50'}">
        <div class="flex items-center gap-2">
          <StatusDot status="running" size={6} />
          <span class="text-sm {dark ? 'text-neutral-200' : 'text-gray-900'}">Project Manager</span>
        </div>
        <span class="text-xs {dark ? 'text-neutral-600' : 'text-gray-400'}">claude-sonnet-4</span>
      </div>
      
      <!-- Messages -->
      <div class="flex-1 p-4 space-y-4 overflow-y-auto">
        {#each demoMessages as msg}
          <div class="flex gap-3">
            <div class="w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0 {dark ? 'bg-neutral-800' : 'bg-gray-200'}">
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
      </div>
      
      <!-- Input -->
      <div class="p-3 border-t {dark ? 'border-neutral-800' : 'border-gray-200'}">
        <div class="flex gap-2">
          <input 
            type="text" 
            placeholder="Message..." 
            class="flex-1 rounded px-3 py-2 text-sm focus:outline-none {dark ? 'bg-neutral-900 border-neutral-800 text-neutral-300 placeholder:text-neutral-600 focus:border-neutral-700' : 'bg-gray-50 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-gray-300 border'}"
          />
          <button class="px-3 py-2 rounded text-sm transition-colors {dark ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}">
            Send
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Mobile Layout: Stacked -->
  <div class="md:hidden">
    <!-- Tree View -->
    <div class="p-3 border-b {dark ? 'border-neutral-800 bg-neutral-900/30' : 'border-gray-200 bg-gray-100'}">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs uppercase tracking-wide {dark ? 'text-neutral-500' : 'text-gray-500'}">Agent Tree</span>
        <span class="text-xs {dark ? 'text-neutral-600' : 'text-gray-400'}">4 agents</span>
      </div>
      
      <div class="space-y-1">
        {#each demoTree as node}
          <div 
            class="flex items-center gap-2 px-2 py-1.5 rounded {node.id === '1' ? (dark ? 'bg-neutral-800/50' : 'bg-gray-200') : ''}"
            style="padding-left: {node.depth * 12 + 8}px"
          >
            <StatusDot status={node.status} size={5} />
            <span class="text-xs {node.id === '1' ? (dark ? 'text-neutral-200' : 'text-gray-900') : (dark ? 'text-neutral-400' : 'text-gray-600')}">{node.name}</span>
          </div>
        {/each}
      </div>
    </div>
    
    <!-- Chat Preview -->
    <div class="p-3 {dark ? 'bg-neutral-950' : 'bg-white'}">
      <div class="flex items-center gap-2 mb-3">
        <StatusDot status="running" size={5} />
        <span class="text-xs {dark ? 'text-neutral-200' : 'text-gray-900'}">Project Manager</span>
      </div>
      
      <div class="space-y-2">
        <p class="text-xs {dark ? 'text-neutral-500' : 'text-gray-500'}">User: Build an API client with tests</p>
        <p class="text-xs {dark ? 'text-neutral-400' : 'text-gray-600'}">Agent: Spawning parallel workers...</p>
      </div>
    </div>
  </div>
</div>
