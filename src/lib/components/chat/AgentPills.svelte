<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import type { AgentStatus } from "$lib/protocol";

  interface AgentPill {
    name: string;
    status: AgentStatus;
  }

  interface Props {
    agents: AgentPill[];
    onnavigate?: (name: string) => void;
  }

  let { agents, onnavigate }: Props = $props();
</script>

<div class="pill-wrap">
  {#each agents as agent}
    <button class="pill" onclick={() => onnavigate?.(agent.name)}>
      <StatusDot status={agent.status} size={4} />
      <span class="pill-name">{agent.name}</span>
    </button>
  {/each}
</div>

<style>
  .pill-wrap {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    padding: 4px 0;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--bg3);
    padding: 4px 10px;
    border-radius: 5px;
    border: 1px solid var(--b1);
    cursor: pointer;
    transition: border 0.1s;
    font-family: var(--m);
    font-size: 11px;
    color: inherit;
  }
  .pill:hover {
    border-color: var(--t5);
  }
  .pill-name {
    color: var(--t2);
  }
</style>
