<script lang="ts">
  import TextMessage from "$lib/components/chat/TextMessage.svelte";
  import ToolBlock from "$lib/components/chat/ToolBlock.svelte";
  import CommandBlock from "$lib/components/chat/CommandBlock.svelte";
  import AgentPills from "$lib/components/chat/AgentPills.svelte";
  import CommitLog from "$lib/components/chat/CommitLog.svelte";
  import TypingIndicator from "$lib/components/chat/TypingIndicator.svelte";
  import type { AgentEvent, AgentStatus } from "$lib/protocol";

  export interface TaskMessage {
    from: "u" | "a";
    event: AgentEvent;
  }

  interface Props {
    messages: TaskMessage[];
    status: AgentStatus;
    task?: string;
    onnavigate?: (name: string) => void;
  }

  let { messages, status, task, onnavigate }: Props = $props();

  let showTyping = $derived(
    (status === "running" || status === "thinking") && messages.length > 0,
  );

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

<div class="task-transcript" use:autoscroll={{ messageCount: messages.length, showTyping }}>
  {#if messages.length === 0}
    <div class="task-transcript-empty">
      <div class="task-transcript-empty-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--t6)" stroke-width="1.5" stroke-linecap="round">
          <path d="M12 3C6.5 3 2 6.58 2 11c0 2.12 1.03 4.04 2.74 5.46L3.5 21l4.75-2.08C9.42 19.3 10.67 19.5 12 19.5c5.5 0 10-3.08 10-6.5S17.5 3 12 3z" />
        </svg>
      </div>
      <span>Run a task to activate this agent</span>
      {#if task}
        <span class="task-transcript-empty-task">{task}</span>
      {/if}
    </div>
  {:else}
    {#each messages as message, index (index)}
      {#if message.event.type === "text"}
        <TextMessage from={message.from} text={message.event.content} />
      {:else if message.event.type === "tool"}
        <div class="task-transcript-item task-transcript-item-agent">
          <ToolBlock
            name={message.event.name}
            path={message.event.path}
            output={message.event.output}
          />
        </div>
      {:else if message.event.type === "command"}
        <div class="task-transcript-item task-transcript-item-agent">
          <CommandBlock
            cmd={message.event.cmd}
            status={message.event.status}
            exit={message.event.exit}
            stdout={message.event.stdout}
            stderr={message.event.stderr}
          />
        </div>
      {:else if message.event.type === "agents"}
        <div class="task-transcript-item task-transcript-item-agent">
          <AgentPills agents={message.event.agents} {onnavigate} />
        </div>
      {:else if message.event.type === "commit"}
        <div class="task-transcript-item task-transcript-item-agent">
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
</div>

<style>
  .task-transcript {
    flex: 1;
    overflow: auto;
    padding: 20px 24px;
  }

  .task-transcript-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding-top: 120px;
    font-family: var(--m);
    font-size: 12px;
    color: var(--t6);
  }

  .task-transcript-empty-icon {
    opacity: 0.3;
  }

  .task-transcript-empty-task {
    max-width: 280px;
    text-align: center;
    line-height: 1.5;
    font-size: 11px;
    color: var(--t5);
  }

  .task-transcript-item {
    margin-bottom: 14px;
  }

  .task-transcript-item-agent {
    display: flex;
    flex-direction: column;
  }
</style>
