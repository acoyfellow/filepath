<script lang="ts">
  import BanIcon from "@lucide/svelte/icons/ban";
  import CheckIcon from "@lucide/svelte/icons/check";
  import CircleIcon from "@lucide/svelte/icons/circle";
  import Clock3Icon from "@lucide/svelte/icons/clock-3";
  import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
  import PlayIcon from "@lucide/svelte/icons/play";
  import RefreshCcwIcon from "@lucide/svelte/icons/refresh-ccw";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
  import { STATUS_COLORS, STATUS_LABELS } from "$lib/protocol";
  import type { AgentStatus } from "$lib/protocol";

  interface Props {
    status: AgentStatus;
    size?: number;
    compact?: boolean;
  }

  let { status, size = 13, compact = false }: Props = $props();

  const iconForStatus: Record<
    AgentStatus,
    typeof CircleIcon
  > = {
    idle: CircleIcon,
    queued: Clock3Icon,
    starting: LoaderCircleIcon,
    thinking: LoaderCircleIcon,
    running: PlayIcon,
    retrying: RefreshCcwIcon,
    done: CheckIcon,
    stalled: TriangleAlertIcon,
    exhausted: BanIcon,
    error: TriangleAlertIcon,
  };

  let Icon = $derived(iconForStatus[status]);
  let color = $derived(STATUS_COLORS[status]);
  let label = $derived(STATUS_LABELS[status]);
</script>

<span
  class={`inline-flex shrink-0 items-center justify-center rounded-full border text-(--status-color) ${
    compact ? "min-w-5 h-5 px-1" : "min-w-6 h-6 px-1.5"
  } ${status === "running" ? "bg-[color-mix(in_srgb,var(--status-color)_14%,var(--bg2))]" : "bg-[color-mix(in_srgb,var(--status-color)_12%,var(--bg2))]"} border-[color-mix(in_srgb,var(--status-color)_24%,var(--b1))]`}
  style={`--status-color:${color}`}
  aria-label={label}
  title={label}
>
  <Icon
    size={size}
    strokeWidth={2.2}
    class={status === "thinking" || status === "starting" ? "animate-spin" : ""}
  />
</span>
