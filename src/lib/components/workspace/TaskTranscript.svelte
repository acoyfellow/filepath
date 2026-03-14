<script lang="ts">
  import MessageCircleIcon from "@lucide/svelte/icons/message-circle";
  import TextMessage from "$lib/components/chat/TextMessage.svelte";
  import ToolBlock from "$lib/components/chat/ToolBlock.svelte";
  import CommandBlock from "$lib/components/chat/CommandBlock.svelte";
  import AgentPills from "$lib/components/chat/AgentPills.svelte";
  import CommitLog from "$lib/components/chat/CommitLog.svelte";
  import TypingIndicator from "$lib/components/chat/TypingIndicator.svelte";
  import type { AgentEvent, AgentStatus } from "$lib/protocol";
  import type { AgentResult } from "$lib/types/workspace";

  export interface TaskMessage {
    from: "u" | "a";
    event: AgentEvent;
  }

  interface Props {
    messages: TaskMessage[];
    status: AgentStatus;
    result?: AgentResult | null;
    task?: string;
    onnavigate?: (name: string) => void;
  }

  let { messages, status, result = null, task, onnavigate }: Props = $props();

  let hasActiveLifecycle = $derived(
    status === "queued" ||
      status === "starting" ||
      status === "running" ||
      status === "thinking" ||
      status === "retrying",
  );
  let showTyping = $derived(
    hasActiveLifecycle && messages.length > 0,
  );
  let lastAssistantText = $derived.by(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.from === "a" && message.event.type === "text") {
        return message.event.content.trim();
      }
    }
    return "";
  });
  let resultMeta = $derived.by(() => {
    if (!result) return [];
    const items: string[] = [];
    if (result.commands.length > 0) {
      items.push(`${result.commands.length} ${result.commands.length === 1 ? "command" : "commands"}`);
    }
    if (result.filesTouched.length > 0) {
      items.push(`${result.filesTouched.length} ${result.filesTouched.length === 1 ? "file" : "files"}`);
    }
    if (result.violations.length > 0) {
      items.push(`${result.violations.length} ${result.violations.length === 1 ? "violation" : "violations"}`);
    }
    if (result.diffSummary) {
      items.push("diff");
    }
    if (result.commit) {
      items.push(`commit ${result.commit.sha.slice(0, 7)}`);
    }
    return items;
  });
  let hasResultDetails = $derived(
    Boolean(
      result &&
        (result.commands.length > 0 ||
          result.filesTouched.length > 0 ||
          result.violations.length > 0 ||
          result.diffSummary ||
          result.commit),
    ),
  );
  let showInlineResultSummary = $derived.by(() => {
    if (!result) return false;
    return result.summary.trim() !== lastAssistantText;
  });
  let resultLabel = $derived.by(() => {
    if (!result) return "";
    switch (result.status) {
      case "success":
        return "Completed";
      case "error":
        return "Failed";
      case "policy_error":
        return "Blocked";
      case "aborted":
        return "Canceled";
      default:
        return "Result";
    }
  });
  let resultAccentClass = $derived.by(() => {
    if (!result) return "";
    switch (result.status) {
      case "success":
        return "bg-emerald-500";
      case "error":
      case "policy_error":
        return "bg-red-500";
      case "aborted":
        return "bg-amber-500";
      default:
        return "bg-(--t4)";
    }
  });
  let shouldRenderResult = $derived.by(() => {
    if (!result || hasActiveLifecycle) return false;
    if (hasResultDetails) return true;
    if (result.status !== "success") return true;
    return !lastAssistantText;
  });

  function autoscroll(
    node: HTMLDivElement,
    _deps: { messageCount: number; showTyping: boolean },
  ) {
    const scrollToBottom = () => {
      queueMicrotask(() => {
        node.scrollTop = node.scrollHeight;
      });
    };

    scrollToBottom();

    return {
      update(_nextDeps: { messageCount: number; showTyping: boolean }) {
        scrollToBottom();
      },
    };
  }
</script>

<div class="min-h-0 flex-1 overflow-auto overscroll-contain px-6 py-5 max-[640px]:px-3 max-[640px]:pb-[18px] max-[640px]:pt-3.5" use:autoscroll={{ messageCount: messages.length, showTyping }}>
  {#if messages.length === 0}
    <div class="flex flex-col items-center gap-2 pt-16 text-center font-(family-name:--f) text-[13px] text-(--t5) max-[640px]:pt-8">
      <div class="opacity-30">
        <MessageCircleIcon size={20} />
      </div>
      <span>Run a task to activate this agent</span>
      {#if task}
        <span class="max-w-[280px] text-xs leading-6 text-(--t4)">{task}</span>
      {/if}
    </div>
  {:else}
    {#each messages as message, index (index)}
      {#if message.event.type === "text"}
        <TextMessage from={message.from} text={message.event.content} />
      {:else if message.event.type === "tool"}
        <div class="mb-3.5 flex flex-col">
          <ToolBlock
            name={message.event.name}
            path={message.event.path}
            output={message.event.output}
          />
        </div>
      {:else if message.event.type === "command"}
        <div class="mb-3.5 flex flex-col">
          <CommandBlock
            cmd={message.event.cmd}
            status={message.event.status}
            exit={message.event.exit}
            stdout={message.event.stdout}
            stderr={message.event.stderr}
          />
        </div>
      {:else if message.event.type === "agents"}
        <div class="mb-3.5 flex flex-col">
          <AgentPills agents={message.event.agents} {onnavigate} />
        </div>
      {:else if message.event.type === "commit"}
        <div class="mb-3.5 flex flex-col">
          <CommitLog commits={[message.event]} />
        </div>
      {:else if message.event.type === "handoff"}
        <TextMessage from="a" text={`Exhausted: ${message.event.summary}`} />
      {:else if message.event.type === "done" && message.event.summary}
        <TextMessage from="a" text={message.event.summary} />
      {/if}
    {/each}
  {/if}

  {#if showTyping}
    <TypingIndicator />
  {/if}

  {#if shouldRenderResult && result}
    <div class="mt-4 flex">
      <div class="max-w-[min(680px,100%)] rounded-2xl border border-(--b1) bg-(--bg2) px-3 py-2.5 font-(family-name:--f) shadow-[0_1px_0_color-mix(in_srgb,var(--shadow)_55%,transparent)]">
        <div class="flex flex-wrap items-center gap-2">
          <span class={`size-1.5 shrink-0 rounded-full ${resultAccentClass}`}></span>
          <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-(--t4)">{resultLabel}</span>
          {#if resultMeta.length > 0}
            <span class="text-[10px] text-(--t5)">{resultMeta.join(" · ")}</span>
          {/if}
        </div>
        {#if showInlineResultSummary}
          <div class="mt-1.5 text-[13px] leading-6 text-(--t2)">{result.summary}</div>
        {/if}
        {#if hasResultDetails}
          <details class="mt-2 rounded-xl border border-(--b1) bg-(--bg3)">
            <summary class="cursor-pointer list-none px-2.5 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-(--t4)">
              Details
            </summary>
            <div class="space-y-2 border-t border-(--b1) px-2.5 py-2 text-xs leading-6 text-(--t4)">
              {#if result.commands.length > 0}
                <div>{result.commands.map((entry) => `${entry.command}${entry.exitCode === null ? "" : ` (${entry.exitCode})`}`).join(" · ")}</div>
              {/if}
              {#if result.filesTouched.length > 0}
                <div>{result.filesTouched.join(", ")}</div>
              {/if}
              {#if result.violations.length > 0}
                <div>{result.violations.join(", ")}</div>
              {/if}
              {#if result.diffSummary}
                <div>{result.diffSummary}</div>
              {/if}
              {#if result.commit}
                <div>{result.commit.sha.slice(0, 7)} · {result.commit.message}</div>
              {/if}
            </div>
          </details>
        {/if}
      </div>
    </div>
  {/if}
</div>
