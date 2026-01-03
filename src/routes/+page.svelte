<script lang="ts">
  import { browser } from "$app/environment";
  import { AGENT_LIST } from "$lib/agents";
  import { Button } from "$lib/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
  } from "$lib/components/ui/card";
  import { goto } from "$app/navigation";
  import { cn } from "$lib/utils";
  import { ExternalLink, Github } from "@lucide/svelte";
  import SEO from "$lib/components/SEO.svelte";

  let loading = $state(false);
  let useCustomSessionId = $state(false);
  let customSessionId = $state("");
  let usePassword = $state(false);
  let password = $state("");

  // All agents are pre-baked - always include all
  const allAgentIds = AGENT_LIST.map((a) => a.id);

  async function launchTerminal() {
    if (!browser) {
      alert("Please use a browser to launch a terminal");
      return;
    }

    loading = true;
    try {
      const body: { agents: string[]; sessionId?: string; password?: string } =
        {
          agents: allAgentIds,
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

<SEO
  title="filepath - AI Terminal Sessions"
  description="Launch terminal sessions with AI agents like Claude, Cursor, and OpenCode. Share your workflow and collaborate in real-time."
  keywords="AI terminal, Claude, Cursor, OpenCode, terminal sessions, AI agents, developer tools"
  path="/"
  type="website"
  section="Home"
  tags="terminal, AI, agents, developer tools"
/>

<div class="min-h-screen bg-background p-8">
  <div class="mx-auto max-w-4xl">
    <section class="max-w-sm mx-auto py-20 text-balance">
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
        <p class="text-muted-foreground mb-6">
          Terminal sessions with AI agents pre-installed. Share your workflow.
        </p>
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

        <div class="flex flex-col items-center gap-4 w-full">
          <Button
            size="lg"
            disabled={loading}
            onclick={launchTerminal}
            class="w-full cursor-pointer"
          >
            {loading ? "Launching..." : "Launch Terminal"}
          </Button>
          <!--
          1) sessions last forever untill manually destroyed.
          2) session data is secure as shit I cant even access their history (creds, etc)
          3) agents can use these (how? api? mcp?) 
         -->
        </div>
      </div>
    </section>

    <div class="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each AGENT_LIST as agent}
        <Card class="transition-all relative">
          <CardHeader>
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
            <CardDescription>{agent.description}</CardDescription>
          </CardHeader>
          <CardContent class="space-y-2">
            <code class="text-xs text-muted-foreground">{agent.command}</code>
          </CardContent>
          <CardFooter
            class="w-full absolute bottom-0 right-0 p-2 items-end justify-end"
          >
            <Button variant="outline" size="sm" href={agent.docsUrl}>
              Docs <ExternalLink class="size-4" />
            </Button>
          </CardFooter>
        </Card>
      {/each}
    </div>
  </div>
</div>
