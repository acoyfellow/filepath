<script lang="ts">
  import { STATUS_COLORS } from "$lib/protocol";
  import type { AgentStatus } from "$lib/protocol";

  interface Props {
    status: AgentStatus;
    size?: number;
  }

  let { status, size = 7 }: Props = $props();

  let color = $derived(STATUS_COLORS[status]);
  let pulsing = $derived(status === "running" || status === "thinking");
</script>

<i class="dot" style:width="{size + 4}px" style:height="{size + 4}px">
  {#if pulsing}
    <i class="dot-pulse" style:width="{size + 8}px" style:height="{size + 8}px" style:background={color}></i>
  {/if}
  <i class="dot-core" style:width="{size}px" style:height="{size}px" style:background={color}></i>
</i>

<style>
  .dot {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-style: normal;
  }
  .dot-pulse {
    position: absolute;
    border-radius: 50%;
    opacity: 0.2;
    animation: pulse 2s ease-in-out infinite;
    font-style: normal;
  }
  .dot-core {
    border-radius: 50%;
    z-index: 1;
    font-style: normal;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.2; }
    50% { transform: scale(1.8); opacity: 0; }
  }
</style>
