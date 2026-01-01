<script lang="ts">
  import { browser } from "$app/environment";
  import { AGENT_LIST, type AgentId } from "$lib/agents";
  import { Button } from "$lib/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card";
  import { goto } from "$app/navigation";
  import { cn } from "$lib/utils";
  import { Github } from "@lucide/svelte";

  let selectedAgents = $state<Set<AgentId>>(new Set());
  let loading = $state(false);
  let useCustomSessionId = $state(false);
  let customSessionId = $state("");
  let usePassword = $state(false);
  let password = $state("");

  function toggleAgent(id: AgentId) {
    if (selectedAgents.has(id)) {
      selectedAgents.delete(id);
    } else {
      selectedAgents.add(id);
    }
    selectedAgents = new Set(selectedAgents);
  }

  function selectAll() {
    selectedAgents = new Set(AGENT_LIST.map((a) => a.id));
  }

  function deselectAll() {
    selectedAgents = new Set();
  }

  async function launchTerminal() {
    if (!browser) {
      alert("Please use a browser to launch a terminal");
      return;
    }
    if (selectedAgents.size === 0) {
      alert("Please select at least one agent");
      return;
    }

    loading = true;
    try {
      const body: { agents: string[]; sessionId?: string; password?: string } =
        {
          agents: Array.from(selectedAgents),
        };
      if (useCustomSessionId && customSessionId.trim()) {
        body.sessionId = customSessionId.trim();
      }
      if (usePassword && password) {
        body.password = password;
      }

      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error || "Failed to create session");
      }

      const { sessionId } = (await response.json()) as { sessionId: string };
      goto(`/terminal/${sessionId}`);
    } catch (error) {
      console.error("Failed to launch terminal:", error);
      alert(
        error instanceof Error ? error.message : "Failed to launch terminal"
      );
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen bg-background p-8">
  <div class="mx-auto max-w-4xl">
    <div class="mb-8 text-center">
      <div class="mb-4 flex items-center justify-center gap-4">
        <h1 class="text-4xl font-bold font-mono">filepath</h1>
        <a
          href="https://github.com/acoyfellow/filepath"
          target="_blank"
          rel="noopener noreferrer"
          class="text-muted-foreground hover:text-foreground transition-colors"
          title="View on GitHub"
        >
          <Github class="size-5" />
        </a>
      </div>
      <p class="text-muted-foreground">
        Terminal sessions with AI agents. Share your workflow.
      </p>
    </div>

    <div class="mb-4 flex justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onclick={selectAll}
        disabled={selectedAgents.size === AGENT_LIST.length}
      >
        Select All
      </Button>
      <Button
        variant="outline"
        size="sm"
        onclick={deselectAll}
        disabled={selectedAgents.size === 0}
      >
        Deselect All
      </Button>
    </div>

    <div class="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each AGENT_LIST as agent}
        <Card
          class={cn(
            "cursor-pointer transition-all hover:border-primary",
            selectedAgents.has(agent.id) && "border-primary"
          )}
          onclick={() => toggleAgent(agent.id)}
        >
          <CardHeader>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <img
                  src={agent.logoUrl}
                  alt={`${agent.name} logo`}
                  class={cn(
                    "size-12 object-contain rounded-full overflow-hidden border-2 border-foreground-muted",
                    agent.id === "codex" && "invert"
                  )}
                />
                <CardTitle class="text-lg">{agent.name}</CardTitle>
              </div>
              <input
                type="checkbox"
                checked={selectedAgents.has(agent.id)}
                onchange={() => toggleAgent(agent.id)}
                onclick={(e) => e.stopPropagation()}
                class="size-4 rounded border-border"
              />
            </div>
            <CardDescription>{agent.description}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-2">
            <code class="text-xs text-muted-foreground">{agent.command}</code>
            <div>
              <a
                href={agent.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-primary hover:underline"
                onclick={(e) => e.stopPropagation()}
              >
                Documentation →
              </a>
            </div>
          </CardContent>
        </Card>
      {/each}
    </div>

    <div class="mb-6 space-y-4">
      <div class="flex items-center gap-2">
        <input
          type="checkbox"
          id="use-custom-id"
          checked={useCustomSessionId}
          onchange={(e) => (useCustomSessionId = e.currentTarget.checked)}
          class="size-4 rounded border-border"
        />
        <label
          for="use-custom-id"
          class="text-sm text-muted-foreground cursor-pointer"
        >
          Use custom session ID
        </label>
      </div>
      {#if useCustomSessionId}
        <input
          type="text"
          placeholder="my-session-id"
          bind:value={customSessionId}
          class="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground"
        />
      {/if}

      <div class="flex items-center gap-2">
        <input
          type="checkbox"
          id="use-password"
          checked={usePassword}
          onchange={(e) => (usePassword = e.currentTarget.checked)}
          class="size-4 rounded border-border"
        />
        <label
          for="use-password"
          class="text-sm text-muted-foreground cursor-pointer"
        >
          Protect with password
        </label>
      </div>
      {#if usePassword}
        <input
          type="password"
          placeholder="Password"
          bind:value={password}
          class="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground"
        />
      {/if}
    </div>

    <div class="flex justify-center">
      <Button
        size="lg"
        disabled={selectedAgents.size === 0 || loading}
        onclick={launchTerminal}
      >
        {loading ? "Launching..." : "Launch Terminal"}
      </Button>
    </div>
  </div>
</div>
