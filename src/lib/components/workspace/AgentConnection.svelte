<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { createConversationAgentClient } from "$lib/agents/agent-client.svelte";
  import type { AgentEventType } from "$lib/protocol";
  import type { AgentResult } from "$lib/types/workspace";
  import type { TaskMessage } from "./TaskTranscript.svelte";

  interface Props {
    agentId: string;
    agentBaseUrl: string;
    onMessages: (messages: TaskMessage[]) => void;
    onResult: (result: AgentResult | null) => void;
    onStatus: (status: "queued" | "running" | "idle" | "error") => void;
    onError: (message: string) => void;
  }

  let { agentId, agentBaseUrl, onMessages, onResult, onStatus, onError }: Props = $props();

  let client: ReturnType<typeof createConversationAgentClient> | null = null;
  const messages: TaskMessage[] = [];

  onMount(() => {
    if (!agentId || !agentBaseUrl) return;

    client = createConversationAgentClient(agentId, agentBaseUrl, {
      onFapEvent: (event: AgentEventType) => {
        messages.push({ from: "a", event });
        onMessages([...messages]);
        onStatus("running");
      },
      onDone: (result) => {
        onResult(result);
        onStatus("idle");
      },
      onError: (err) => {
        onError(err);
        onStatus("error");
      },
      onStatus: (s) => {
        if (s === "closed") onStatus("idle");
      },
    });
  });

  onDestroy(() => {
    client?.close();
    client = null;
  });

  export async function runTask(content: string): Promise<{ taskId: string; ok: boolean }> {
    if (!client) throw new Error("Agent not connected");
    await client.ready;
    return client.call("runTask", [content]) as Promise<{ taskId: string; ok: boolean }>;
  }

  export function cancelTask(): void {
    client?.call("cancelTask", []);
  }
</script>

<!-- Logic-only component: manages WebSocket connection to ConversationAgent DO -->
