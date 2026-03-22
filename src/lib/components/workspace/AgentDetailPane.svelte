<script lang="ts">
  import CirclePauseIcon from "@lucide/svelte/icons/circle-pause";
  import LockIcon from "@lucide/svelte/icons/lock";
  import LockOpenIcon from "@lucide/svelte/icons/lock-open";
  import CircleStopIcon from "@lucide/svelte/icons/circle-stop";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import StatusDot from "$lib/components/shared/StatusDot.svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { STATUS_LABELS } from "$lib/protocol";
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
    /** True while initial runtime / transcript fetch for this conversation. */
    transcriptLoading?: boolean;
    onsend: (message: string) => void;
    oncancel?: () => void;
    onpause?: () => void;
    onresume?: () => void;
    onapprove?: () => void;
    onreject?: () => void;
    onclose?: () => void;
    onreopen?: () => void;
    onopensettings?: () => void;
    onnavigate?: (name: string) => void;
  }

  let {
    agent,
    activeTask = null,
    messages,
    result = null,
    notice = null,
    transcriptLoading = false,
    onsend,
    oncancel,
    onpause,
    onresume,
    onapprove,
    onreject,
    onclose,
    onreopen,
    onopensettings,
    onnavigate,
  }: Props = $props();

  /** Avoid skeleton flash when runtime fetch finishes fast (<200ms). */
  let showTranscriptSkeleton = $state(false);

  $effect(() => {
    if (!transcriptLoading) {
      showTranscriptSkeleton = false;
      return;
    }
    const t = setTimeout(() => {
      showTranscriptSkeleton = true;
    }, 200);
    return () => clearTimeout(t);
  });

  let isExhausted = $derived(agent?.status === "exhausted");
  let isClosed = $derived(Boolean(agent?.closedAt));
  let pendingInterruption = $derived(agent?.latestInterruption ?? null);
  let isBlocked = $derived(pendingInterruption?.status === "pending");
  let canCancel = $derived(Boolean(activeTask && oncancel));
  let canPause = $derived(Boolean(activeTask && onpause && !isBlocked));
  let composerDisabled = $derived(
    Boolean(transcriptLoading || isExhausted || isClosed || isBlocked || activeTask),
  );
  let composerPlaceholder = $derived.by(() => {
    if (transcriptLoading) return "Loading conversation…";
    if (isClosed) return "Conversation closed";
    if (pendingInterruption?.kind === "approval") return "Waiting on approval";
    if (pendingInterruption?.kind === "pause") return "Conversation paused";
    if (notice?.blocking) return notice.title;
    if (activeTask) return notice?.title ?? "Task in progress";
    if (isExhausted) return "Agent exhausted";
    if (agent?.status === "idle" && messages.length === 0) return "Start the first conversation turn...";
    return "Describe the next turn...";
  });
</script>

{#if agent}
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="sticky top-0 z-10 flex shrink-0 flex-col gap-1.5 border-b border-(--b1) bg-(--bg2) px-4 py-2.5 max-[900px]:px-3">
      <div class="flex items-center justify-between gap-3 max-[900px]:flex-col max-[900px]:items-start">
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Sidebar.Trigger class="-ms-1 size-8 shrink-0 md:hidden" />
          <span class="inline-flex shrink-0" title={STATUS_LABELS[agent.status]}>
            <StatusDot status={agent.status} size={7} />
          </span>
          <span class="min-w-0 truncate font-(family-name:--f) text-base font-[650] tracking-[-0.02em] text-(--t1) max-[640px]:text-[15px]">
            {agent.name}
          </span>
          {#if agent.conversationState}
            <span
              class="rounded-full border border-(--b1) bg-(--bg3) px-2 py-0.5 text-[10px] font-[650] uppercase tracking-[0.14em] text-(--t4)"
              title="Workflow: blocked / running / ready / closed (from conversation rules). Differs from runtime dot (adapter task state)."
            >
              {agent.conversationState}
            </span>
          {/if}
        </div>
        <div class="flex w-full shrink-0 flex-wrap items-center justify-start gap-2 min-[901px]:w-auto">
          {#if canPause}
            <Button
              variant="outline"
              size="icon-sm"
              class="size-8 rounded-full border-(--b1) bg-(--bg2) text-(--t2) shadow-none hover:border-(--t4) hover:bg-(--bg3) hover:text-(--t1)"
              onclick={onpause}
              aria-label="Pause conversation"
              title="Pause conversation"
            >
              <CirclePauseIcon size={15} />
            </Button>
          {/if}
          {#if isBlocked && pendingInterruption?.kind === "approval" && onapprove}
            <Button
              variant="outline"
              class="h-8 rounded-full border-emerald-500/30 bg-emerald-500/10 px-3 text-[11px] font-[650] text-emerald-700 shadow-none hover:bg-emerald-500/15 dark:text-emerald-300"
              onclick={onapprove}
            >
              Approve
            </Button>
          {/if}
          {#if isBlocked && pendingInterruption?.kind === "approval" && onreject}
            <Button
              variant="outline"
              class="h-8 rounded-full border-red-500/30 bg-red-500/10 px-3 text-[11px] font-[650] text-red-700 shadow-none hover:bg-red-500/15 dark:text-red-300"
              onclick={onreject}
            >
              Reject
            </Button>
          {/if}
          {#if isBlocked && pendingInterruption?.kind === "pause" && onresume}
            <Button
              variant="outline"
              class="h-8 rounded-full border-sky-500/30 bg-sky-500/10 px-3 text-[11px] font-[650] text-sky-700 shadow-none hover:bg-sky-500/15 dark:text-sky-300"
              onclick={onresume}
            >
              Resume
            </Button>
          {/if}
          {#if !isClosed && !activeTask && !isBlocked && onclose}
            <Button
              variant="outline"
              size="icon-sm"
              class="size-8 rounded-full border-(--b1) bg-(--bg2) text-(--t2) shadow-none hover:border-(--t4) hover:bg-(--bg3) hover:text-(--t1)"
              onclick={onclose}
              aria-label="Close conversation"
              title="Close conversation"
            >
              <LockIcon size={15} />
            </Button>
          {/if}
          {#if isClosed && onreopen}
            <Button
              variant="outline"
              size="icon-sm"
              class="size-8 rounded-full border-(--b1) bg-(--bg2) text-(--t2) shadow-none hover:border-(--t4) hover:bg-(--bg3) hover:text-(--t1)"
              onclick={onreopen}
              aria-label="Reopen conversation"
              title="Reopen conversation"
            >
              <LockOpenIcon size={15} />
            </Button>
          {/if}
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
      {#if isClosed}
        <div class="mx-4 mt-3 rounded-xl border border-(--b1) bg-(--bg3) px-3 py-2.5 font-(family-name:--f) text-xs leading-6 text-(--t3) max-[900px]:mx-3">
          <div class="mb-1 font-semibold">Closed</div>
          <div>This conversation is frozen until you reopen it.</div>
        </div>
      {:else if pendingInterruption?.status === "pending"}
        <div class="mx-4 mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 font-(family-name:--f) text-xs leading-6 text-amber-700 dark:text-amber-300 max-[900px]:mx-3">
          <div class="mb-1 font-semibold">
            {pendingInterruption.kind === "approval" ? "Approval required" : "Paused"}
          </div>
          <div>{pendingInterruption.summary}</div>
        </div>
      {:else if notice}
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
      {:else if !transcriptLoading && agent.status === "idle" && messages.length === 0}
        <div class="mx-4 mt-3 rounded-xl border border-(--b1) bg-[color-mix(in_srgb,var(--accent)_11%,var(--bg3))] px-3 py-2.5 font-(family-name:--f) text-xs leading-6 text-(--t2) max-[900px]:mx-3">
        <div class="mb-1 font-semibold">Ready</div>
        <div>This conversation is ready for its first turn.</div>
      </div>
      {/if}

      {#if isExhausted}
        <div class="border-b border-(--b1) bg-[color-mix(in_srgb,#fb923c_10%,transparent)] px-4 py-2.5 font-(family-name:--f) text-xs text-[#fb923c] max-[900px]:px-3">
          This agent is exhausted. Its history remains visible, but it is read-only for now.
        </div>
      {/if}

      {#if transcriptLoading && messages.length === 0}
        {#if showTranscriptSkeleton}
          <div
            class="flex min-h-0 flex-1 flex-col justify-end gap-3 px-6 py-5 max-[640px]:px-3"
            aria-busy="true"
            aria-label="Loading conversation"
          >
            <div class="h-3 w-2/3 max-w-md animate-pulse rounded-md bg-(--bg3)"></div>
            <div class="h-3 w-1/2 max-w-sm animate-pulse rounded-md bg-(--bg3)"></div>
            <div class="h-24 w-full max-w-xl animate-pulse rounded-2xl bg-(--bg3)"></div>
          </div>
        {:else}
          <div class="min-h-[min(40dvh,220px)] flex-1 shrink-0" aria-hidden="true"></div>
        {/if}
      {:else}
        <TaskTranscript {messages} {result} status={agent.status} {onnavigate} />
      {/if}
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
      <span class="font-(family-name:--f) text-[13px] text-(--t5)">Select a conversation</span>
    </div>
    <div class="flex flex-1 items-center justify-center font-(family-name:--f) text-[13px] text-(--t5)">
      <span>Choose a conversation from the sidebar</span>
    </div>
  </div>
{/if}
