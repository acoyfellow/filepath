<script lang="ts">
  import CircleStopIcon from "@lucide/svelte/icons/circle-stop";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import StatusGlyph from "$lib/components/shared/StatusGlyph.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import type { AgentRecord, AgentResult, AgentRuntimeActiveTask } from "$lib/types/workspace";
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
    activeTask?: AgentRuntimeActiveTask | null;
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
    activeTask = null,
    messages,
    result = null,
    notice = null,
    onsend,
    oncancel,
    onopensettings,
    onnavigate,
  }: Props = $props();

  let isExhausted = $derived(agent?.status === "exhausted");
  let canCancel = $derived(Boolean(activeTask && oncancel));
  let scopeLabel = $derived.by(() => {
    const raw = agent?.writableRoot ?? ".";
    if (!raw || raw === "." || raw === "./") return "repo root";
    return raw;
  });
  let composerDisabled = $derived(Boolean(isExhausted || notice?.blocking || activeTask));
  let composerPlaceholder = $derived.by(() => {
    if (notice?.blocking) return notice.title;
    if (activeTask) return notice?.title ?? "Task in progress";
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
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="sticky top-0 z-10 flex shrink-0 flex-col gap-1.5 border-b border-(--b1) bg-(--bg2) px-4 py-2.5 max-[900px]:px-3">
      <div class="flex items-center justify-between gap-3 max-[900px]:flex-col max-[900px]:items-start">
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <Sidebar.Trigger class="-ms-1 size-8 shrink-0 md:hidden" />
            <StatusDot status={agent.status} size={7} />
            <span class="min-w-0 truncate font-(family-name:--f) text-base font-[650] tracking-[-0.02em] text-(--t1) max-[640px]:text-[15px]">
              {agent.name}
            </span>
            <StatusGlyph status={agent.status} compact />
          </div>
          <div class="mt-1 pl-9 text-[11px] leading-5 text-(--t5) max-[640px]:pl-0">
            {summaryLine}
            <span class="ml-1">· this agent reuses its own sandboxed repo clone between tasks.</span>
          </div>
        </div>
        <div class="flex w-full shrink-0 flex-wrap items-center justify-start gap-2 min-[901px]:w-auto">
          <Button
            variant="outline"
            size="icon-sm"
            class="size-8 rounded-full border-(--b1) bg-(--bg2) text-(--t2) shadow-none hover:border-(--t4) hover:bg-(--bg3) hover:text-(--t1)"
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
      
    </div>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      {#if notice}
        <div
          class={`mx-4 mt-3 rounded-xl border px-3 py-2.5 font-(family-name:--f) text-xs leading-6 max-[900px]:mx-3 ${
            notice.tone === "info"
              ? "border-(--b1) bg-[color-mix(in_srgb,var(--accent)_11%,var(--bg3))] text-(--t2)"
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
        <div class="mx-4 mt-3 rounded-xl border border-(--b1) bg-[color-mix(in_srgb,var(--accent)_11%,var(--bg3))] px-3 py-2.5 font-(family-name:--f) text-xs leading-6 text-(--t2) max-[900px]:mx-3">
        <div class="mb-1 font-semibold">Ready</div>
        <div>This agent is ready for its first task.</div>
      </div>
      {/if}

      {#if isExhausted}
        <div class="border-b border-(--b1) bg-[color-mix(in_srgb,#fb923c_10%,transparent)] px-4 py-2.5 font-(family-name:--f) text-xs text-[#fb923c] max-[900px]:px-3">
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
  <div class="flex h-full flex-col">
    <div class="flex shrink-0 items-center gap-2 border-b border-(--b1) bg-(--bg2) px-4 py-2.5 max-[900px]:px-3">
      <Sidebar.Trigger class="-ms-1 size-8 md:hidden" />
      <span class="font-(family-name:--f) text-[13px] text-(--t5)">Select an agent</span>
    </div>
    <div class="flex flex-1 items-center justify-center font-(family-name:--f) text-[13px] text-(--t5)">
      <span>Choose an agent from the sidebar</span>
    </div>
  </div>
{/if}
