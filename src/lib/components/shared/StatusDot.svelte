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

<i
  class="relative inline-flex shrink-0 items-center justify-center"
  style:width="{size + 4}px"
  style:height="{size + 4}px"
>
  {#if pulsing}
    <i
      class="absolute rounded-full opacity-20 animate-ping"
      style:width="{size + 8}px"
      style:height="{size + 8}px"
      style:background={color}
    ></i>
  {/if}
  <i
    class="z-[1] rounded-full"
    style:width="{size}px"
    style:height="{size}px"
    style:background={color}
  ></i>
</i>
