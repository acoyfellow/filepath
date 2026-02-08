<script lang="ts">
  import TextMessage from "$lib/components/chat/TextMessage.svelte";
  import ToolBlock from "$lib/components/chat/ToolBlock.svelte";
  import CommandBlock from "$lib/components/chat/CommandBlock.svelte";
  import WorkerPills from "$lib/components/chat/WorkerPills.svelte";
  import CommitLog from "$lib/components/chat/CommitLog.svelte";
  import TypingIndicator from "$lib/components/chat/TypingIndicator.svelte";
  import type { AgentEvent } from "$lib/protocol";
  import type { AgentStatus } from "$lib/protocol";

  /**
   * Chat message as stored/displayed. Each message wraps a protocol event
   * with a sender indicator.
   */
  export interface ChatMsg {
    from: "u" | "a";
    event: AgentEvent;
  }

  interface Props {
    messages: ChatMsg[];
    status: AgentStatus;
    task?: string;
    onnavigate?: (name: string) => void;
  }

  let { messages, status, task, onnavigate }: Props = $props();

  let scrollRef: HTMLDivElement | undefined = $state(undefined);
  let showTyping = $derived(
    (status === "running" || status === "thinking") && messages.length > 0,
  );

  // Auto-scroll to bottom when messages change
  $effect(() => {
    // Access messages.length to create dependency
    messages.length;
    if (scrollRef) {
      scrollRef.scrollTop = scrollRef.scrollHeight;
    }
  });
</script>

<div class="chat-scroll" bind:this={scrollRef}>
  {#if messages.length === 0}
    <div class="chat-empty">
      <div class="chat-empty-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--t6)" stroke-width="1.5" stroke-linecap="round">
          <path d="M12 3C6.5 3 2 6.58 2 11c0 2.12 1.03 4.04 2.74 5.46L3.5 21l4.75-2.08C9.42 19.3 10.67 19.5 12 19.5c5.5 0 10-3.08 10-6.5S17.5 3 12 3z" />
        </svg>
      </div>
      <span>Send a message to activate this agent</span>
      {#if task}
        <span class="chat-empty-task">{task}</span>
      {/if}
    </div>
  {:else}
    {#each messages as msg, i (i)}
      {#if msg.event.type === "text"}
        <TextMessage from={msg.from} text={msg.event.content} />
      {:else if msg.event.type === "tool"}
        <div class="msg msg-a">
          <ToolBlock name={msg.event.name} path={msg.event.path} output={msg.event.output} />
        </div>
      {:else if msg.event.type === "command"}
        <div class="msg msg-a">
          <CommandBlock
            cmd={msg.event.cmd}
            status={msg.event.status}
            exit={msg.event.exit}
            stdout={msg.event.stdout}
            stderr={msg.event.stderr}
          />
        </div>
      {:else if msg.event.type === "workers"}
        <div class="msg msg-a">
          <WorkerPills workers={msg.event.workers} {onnavigate} />
        </div>
      {:else if msg.event.type === "commit"}
        <div class="msg msg-a">
          <CommitLog commits={[msg.event]} />
        </div>
      {/if}
    {/each}
  {/if}

  {#if showTyping}
    <TypingIndicator />
  {/if}
</div>

<style>
  .chat-scroll {
    flex: 1;
    overflow: auto;
    padding: 20px 24px;
  }
  .chat-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding-top: 120px;
    color: var(--t6);
    font-family: var(--m);
    font-size: 12px;
  }
  .chat-empty-icon {
    opacity: 0.3;
  }
  .chat-empty-task {
    font-size: 11px;
    color: var(--t5);
    max-width: 280px;
    text-align: center;
    line-height: 1.5;
  }
  .msg {
    margin-bottom: 14px;
  }
  .msg-a {
    display: flex;
    flex-direction: column;
  }
</style>
