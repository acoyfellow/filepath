<script lang="ts">
  import CircleStopIcon from "@lucide/svelte/icons/circle-stop";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import StatusGlyph from "$lib/components/shared/StatusGlyph.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import type { AgentRecord, AgentResult } from "$lib/types/workspace";
  import TaskComposer from "./TaskComposer.svelte";
  import type { TaskMessage } from "./TaskTranscript.svelte";
  import TaskTranscript from "./TaskTranscript.svelte";

  type AgentNotice = {
    tone: "info" | "warning" | "error" | "success";
    title: string;
    message: string;
    blocking?: boolean;
  };

  interface Props {
    agent: AgentRecord | null;
    messages: TaskMessage[];
    result?: AgentResult | null;
    notice?: AgentNotice | null;
    onsend: (message: string) => void;
    oncancel?: () => void;
    onopensettings?: () => void;
    onnavigate?: (name: string) => void;
  }

  let {
    agent,
    messages,
    result = null,
    notice = null,
    onsend,
    oncancel,
    onopensettings,
    onnavigate,
  }: Props = $props();

  let isExhausted = $derived(agent?.status === "exhausted");
  let canCancel = $derived(Boolean(agent?.activeProcessId && oncancel));
  let scopeLabel = $derived.by(() => {
    const raw = agent?.writableRoot ?? ".";
    if (!raw || raw === "." || raw === "./") return "repo root";
    return raw;
  });
  let composerDisabled = $derived(Boolean(isExhausted || notice?.blocking));
  let composerPlaceholder = $derived.by(() => {
    if (notice?.blocking) return notice.title;
    if (isExhausted) return "Agent exhausted";
    if (agent?.status === "idle" && messages.length === 0) return "Start the first task...";
    return "Describe the next task...";
  });
  let summaryLine = $derived.by(() => {
    if (!agent) return "";
    const parts = [agent.harnessId, agent.model, `scope ${scopeLabel}`];
    if (agent.tokens > 0) parts.push(`${agent.tokens.toLocaleString()} tokens`);
    return parts.join(" · ");
  });
</script>

{#if agent}
  <div class="flex h-full flex-col">
    <div class="flex shrink-0 flex-col gap-1.5 border-b border-[var(--b1)] px-4 py-2.5 max-[900px]:px-3">
      <div class="flex items-center justify-between gap-3 max-[900px]:flex-col max-[900px]:items-start">
        <div class="flex flex-wrap items-center gap-2">
          <StatusDot status={agent.status} size={7} />
          <span class="font-[var(--f)] text-base font-[650] tracking-[-0.02em] text-[var(--t1)] max-[640px]:text-[15px]">
            {agent.name}
          </span>
          <StatusGlyph status={agent.status} compact />
        </div>
        <div class="flex w-full flex-wrap items-center justify-start gap-2 min-[901px]:w-auto">
          <Button
            variant="outline"
            size="icon-sm"
            class="size-8 rounded-full border-[var(--b1)] bg-[var(--bg2)] text-[var(--t2)] shadow-none hover:border-[var(--t4)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
            data-testid="open-agent-settings"
            onclick={onopensettings}
            aria-label="Agent settings"
            title="Agent settings"
          >
            <Settings2Icon size={15} />
          </Button>
          {#if canCancel}
            <Button
              variant="destructive"
              size="icon-sm"
              class="size-8 rounded-full border border-[color-mix(in_srgb,#ef4444_34%,var(--b2))] bg-[color-mix(in_srgb,#ef4444_14%,var(--bg3))] text-red-300 shadow-none hover:border-[color-mix(in_srgb,#ef4444_50%,var(--b2))] hover:bg-[color-mix(in_srgb,#ef4444_18%,var(--bg4))] hover:text-red-100"
              onclick={oncancel}
              aria-label="Cancel active task"
              title="Cancel active task"
            >
              <CircleStopIcon size={15} />
            </Button>
          {/if}
        </div>
      </div>
      <div class="font-[var(--f)] text-xs leading-[1.4] text-[var(--t4)] max-[640px]:text-[11px]">
        {summaryLine}
      </div>
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      {#if notice}
        <div
          class={`mx-4 mt-3 rounded-xl border px-3 py-2.5 font-[var(--f)] text-xs leading-6 max-[900px]:mx-3 ${
            notice.tone === "info"
              ? "border-[var(--b1)] bg-[color-mix(in_srgb,var(--accent)_11%,var(--bg3))] text-[var(--t2)]"
              : notice.tone === "warning"
                ? "border-amber-400/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : notice.tone === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <div class="mb-1 font-semibold">{notice.title}</div>
          <div>{notice.message}</div>
        </div>
      {:else if agent.status === "idle" && messages.length === 0}
        <div class="mx-4 mt-3 rounded-xl border border-[var(--b1)] bg-[color-mix(in_srgb,var(--accent)_11%,var(--bg3))] px-3 py-2.5 font-[var(--f)] text-xs leading-6 text-[var(--t2)] max-[900px]:mx-3">
          <div class="mb-1 font-semibold">Ready</div>
          <div>This agent is ready for its first task.</div>
        </div>
      {/if}

      {#if isExhausted}
        <div class="border-b border-[var(--b1)] bg-[color-mix(in_srgb,#fb923c_10%,transparent)] px-4 py-2.5 font-[var(--f)] text-xs text-[#fb923c] max-[900px]:px-3">
          This agent is exhausted. Its history remains visible, but it is read-only for now.
        </div>
      {/if}

      <TaskTranscript {messages} {result} status={agent.status} {onnavigate} />
    </div>

    <TaskComposer
      {onsend}
      disabled={composerDisabled}
      placeholder={composerPlaceholder}
      actionLabel="Run task"
    />
  </div>
{:else}
  <div class="flex h-full items-center justify-center font-[var(--f)] text-[13px] text-[var(--t5)]">
    <span>Select an agent</span>
  </div>
{/if}
