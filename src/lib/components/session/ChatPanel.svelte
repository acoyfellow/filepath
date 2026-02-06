<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Input } from '$lib/components/ui/input';
  import { Separator } from '$lib/components/ui/separator';
  import { tick } from 'svelte';

  export interface ChatMessage {
    id: string;
    role: 'user' | 'agent';
    content: string;
    timestamp: number;
    status?: 'sending' | 'complete' | 'error';
  }

  interface Props {
    agentName: string;
    agentIcon: string;
    messages: ChatMessage[];
    collapsed: boolean;
    isConnected: boolean;
    onSendMessage: (content: string) => void;
    onToggleCollapse: () => void;
  }

  let {
    agentName,
    agentIcon,
    messages,
    collapsed,
    isConnected,
    onSendMessage,
    onToggleCollapse,
  }: Props = $props();

  let inputValue = $state('');
  let messagesContainer: HTMLDivElement | undefined = $state();

  let isWaitingForAgent = $derived(
    messages.length > 0 && messages[messages.length - 1].role === 'user'
  );

  // Auto-scroll on new messages
  $effect(() => {
    // Track messages array length to trigger effect
    messages.length;
    tick().then(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });
  });

  function handleSend() {
    const trimmed = inputValue.trim();
    if (!trimmed || !isConnected) return;
    onSendMessage(trimmed);
    inputValue = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  interface ContentSegment {
    type: 'text' | 'code';
    content: string;
    lang?: string;
  }

  function parseContent(content: string): ContentSegment[] {
    const segments: ContentSegment[] = [];
    const regex = /```(\w*)?\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      // Text before the code block
      if (match.index > lastIndex) {
        const text = content.slice(lastIndex, match.index);
        if (text.trim()) {
          segments.push({ type: 'text', content: text });
        }
      }
      segments.push({ type: 'code', content: match[2], lang: match[1] || undefined });
      lastIndex = match.index + match[0].length;
    }

    // Remaining text after last code block
    if (lastIndex < content.length) {
      const text = content.slice(lastIndex);
      if (text.trim()) {
        segments.push({ type: 'text', content: text });
      }
    }

    // If no segments parsed, return the whole thing as text
    if (segments.length === 0) {
      segments.push({ type: 'text', content });
    }

    return segments;
  }
</script>

{#if collapsed}
  <!-- Collapsed thin bar -->
  <div class="flex h-full w-10 flex-col items-center border-x border-neutral-800 bg-neutral-950">
    <button
      onclick={onToggleCollapse}
      class="flex w-full items-center justify-center py-3 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
      aria-label="Expand chat panel"
    >
      <span class="text-xs">»</span>
    </button>
    <Separator class="bg-neutral-800" />
    <div class="flex flex-1 items-center justify-center">
      <span
        class="whitespace-nowrap text-xs font-medium tracking-wider text-neutral-500"
        style="writing-mode: vertical-rl; text-orientation: mixed;"
      >
        {agentIcon} {agentName}
      </span>
    </div>
  </div>
{:else}
  <!-- Expanded chat panel -->
  <div class="flex h-full min-w-0 flex-1 flex-col border-x border-neutral-800 bg-neutral-950">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
      <div class="flex items-center gap-2.5">
        <span class="text-lg">{agentIcon}</span>
        <div>
          <h2 class="text-sm font-semibold text-neutral-100">Orchestrator</h2>
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-neutral-400">{agentName}</span>
            <Badge
              variant={isConnected ? 'default' : 'outline'}
              class="text-[10px] {isConnected ? 'bg-emerald-600 text-white' : 'border-neutral-600 text-neutral-500'}"
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
        </div>
      </div>
      <button
        onclick={onToggleCollapse}
        class="flex size-7 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
        aria-label="Collapse chat panel"
      >
        <span class="text-xs">«</span>
      </button>
    </div>

    <!-- Messages area -->
    <div
      bind:this={messagesContainer}
      class="flex-1 overflow-y-auto px-4 py-3"
    >
      {#if messages.length === 0}
        <div class="flex h-full items-center justify-center">
          <p class="text-sm text-neutral-600">No messages yet. Start a conversation.</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each messages as message (message.id)}
            <div class="group flex gap-3 {message.role === 'user' ? 'flex-row-reverse' : ''}">
              <!-- Avatar -->
              <div
                class="flex size-7 shrink-0 items-center justify-center rounded-full text-sm
                  {message.role === 'agent' ? 'bg-neutral-800' : 'bg-blue-900/50'}"
              >
                {message.role === 'agent' ? agentIcon : '👤'}
              </div>

              <!-- Message bubble -->
              <div class="min-w-0 max-w-[80%] space-y-1">
                <div class="flex items-center gap-2 {message.role === 'user' ? 'flex-row-reverse' : ''}">
                  <span class="text-xs font-medium text-neutral-400">
                    {message.role === 'agent' ? agentName : 'You'}
                  </span>
                  <span class="text-[10px] text-neutral-600">{formatTime(message.timestamp)}</span>
                  {#if message.status === 'sending'}
                    <span class="text-[10px] text-amber-500">Sending…</span>
                  {:else if message.status === 'error'}
                    <span class="text-[10px] text-red-400">Error</span>
                  {/if}
                </div>

                <div
                  class="rounded-lg px-3 py-2 text-sm leading-relaxed
                    {message.role === 'agent'
                      ? 'bg-neutral-900 text-neutral-200'
                      : 'bg-blue-900/30 text-blue-100'}"
                >
                  {#each parseContent(message.content) as segment}
                    {#if segment.type === 'code'}
                      <pre class="my-2 overflow-x-auto rounded bg-neutral-950 p-3 text-xs leading-relaxed"><code class="font-mono text-emerald-400">{segment.content}</code></pre>
                    {:else}
                      <p class="whitespace-pre-wrap">{segment.content}</p>
                    {/if}
                  {/each}
                </div>
              </div>
            </div>
          {/each}

          <!-- Typing indicator -->
          {#if isWaitingForAgent}
            <div class="flex gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm">
                {agentIcon}
              </div>
              <div class="rounded-lg bg-neutral-900 px-3 py-2">
                <div class="flex items-center gap-1">
                  <span class="inline-block size-1.5 animate-bounce rounded-full bg-neutral-500" style="animation-delay: 0ms"></span>
                  <span class="inline-block size-1.5 animate-bounce rounded-full bg-neutral-500" style="animation-delay: 150ms"></span>
                  <span class="inline-block size-1.5 animate-bounce rounded-full bg-neutral-500" style="animation-delay: 300ms"></span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Input area -->
    <div class="border-t border-neutral-800 px-4 py-3">
      <div class="flex items-center gap-2">
        <Input
          type="text"
          placeholder={isConnected ? 'Send a message…' : 'Disconnected'}
          disabled={!isConnected}
          bind:value={inputValue}
          onkeydown={handleKeydown}
          class="flex-1 border-neutral-700 bg-neutral-900 text-neutral-200 placeholder:text-neutral-600"
        />
        <Button
          variant="default"
          size="sm"
          disabled={!isConnected || !inputValue.trim()}
          onclick={handleSend}
        >
          Send
        </Button>
      </div>
    </div>
  </div>
{/if}
