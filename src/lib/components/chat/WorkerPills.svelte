<script lang="ts">
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import type { AgentStatus } from "$lib/protocol";

  interface Worker {
    name: string;
    status: AgentStatus;
  }

  interface Props {
    workers: Worker[];
    onnavigate?: (name: string) => void;
  }

  let { workers, onnavigate }: Props = $props();
</script>

<div class="wp-wrap">
  {#each workers as w}
    <button class="wp" onclick={() => onnavigate?.(w.name)}>
      <StatusDot status={w.status} size={4} />
      <span class="wp-name">{w.name}</span>
    </button>
  {/each}
</div>

<style>
  .wp-wrap {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    padding: 4px 0;
  }
  .wp {
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
  .wp:hover {
    border-color: var(--t5);
  }
  .wp-name {
    color: var(--t2);
  }
</style>
