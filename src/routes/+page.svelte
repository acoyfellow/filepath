<script lang="ts">
  import SEO from "$lib/components/SEO.svelte";
  import Button from "$lib/components/ui/button/button.svelte";

  const facts: string[] = [
    "Workspaces with isolated sandboxes — clone a repo, set allowed paths, run agents against it",
    "Tasks run on the server — step away, come back in the browser, pick up where you left off",
    "Your model keys — paste OpenRouter or OpenCode Zen in Settings; no bundled subscription",
    "Harness registry — Codex, Shelley, Cursor, Hermes out of the box; add your own",
    "Enforced tool scope — read, write, run, commit permissions checked at runtime, not by prompt",
    "Conversation states — ready, running, blocked, closed; pause, approve, or reject mid-run",
    "HTTP API + API keys — automate anything the dashboard can do",
    "Open source, self-hosted on your Cloudflare account",
  ];
</script>

<SEO
  title="filepath | Sandboxed background agents on your Cloudflare"
  description="Personal web app for running bounded background agents in isolated sandboxes on Cloudflare. BYO model keys, harness registry, enforced tool scope."
  keywords="filepath, ai agents, cloudflare, sandbox, openrouter, opencode, harnesses"
  path="/"
  type="website"
  section="Product"
  tags="agents,cloudflare,workspaces"
/>

<div class="min-h-screen bg-gray-50 text-gray-900 dark:bg-neutral-950 dark:text-neutral-100">
  <main class="mx-auto max-w-2xl px-6 py-14 md:py-24">
    <section class="border-b border-gray-200 pb-10 dark:border-neutral-800">
      <p class="text-[11px] font-medium uppercase tracking-[0.22em] text-gray-400 dark:text-neutral-500">
        Personal · Self-hosted · Cloudflare
      </p>
      <h1 class="mt-4 text-3xl font-semibold tracking-tight text-balance md:text-5xl md:leading-[1.1]">
        Your own background agent environment.
      </h1>
      <p class="mt-5 max-w-xl text-base leading-7 text-gray-600 dark:text-neutral-400">
        A personal web app: workspaces, sandboxed filesystems, a harness registry, and your own model keys.
        Built for one person, on infrastructure they own.
      </p>

      <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button href="/dashboard">Open dashboard</Button>
        <Button href="https://github.com/acoyfellow/filepath" variant="outline" class="rounded-full">
          Source on GitHub
        </Button>
      </div>
    </section>

    <ul class="mt-10 space-y-3">
      {#each facts as fact}
        <li class="flex gap-3 text-sm leading-relaxed text-gray-700 dark:text-neutral-300">
          <span class="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-neutral-500"></span>
          {fact}
        </li>
      {/each}
    </ul>
  </main>
</div>
