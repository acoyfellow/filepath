<script lang="ts">
  import SEO from "$lib/components/SEO.svelte";
  import Button from "$lib/components/ui/button/button.svelte";

  const usps: { id: string; title: string; line: string }[] = [
    {
      id: "orchestrate",
      title: "Orchestrate from any device",
      line:
        "One dashboard for long sessions and many parallel threads—your daily driver, not a single-shot chat window.",
    },
    {
      id: "keys",
      title: "BYO router keys",
      line:
        "Bring your own OpenRouter and OpenCode Zen keys; wire the model routing you already use.",
    },
    {
      id: "agents",
      title: "BYO agents & harnesses",
      line:
        "Registry-backed harnesses (Codex, Shelley, Cursor, and more)—plus room to add custom and dynamic runners.",
    },
    {
      id: "cloudflare",
      title: "Your Cloudflare",
      line:
        "Runs on infrastructure you own: DX, tunables, and security models you control. Scope paths and tools per agent.",
    },
    {
      id: "hackable",
      title: "Hackable",
      line: "Open codebase and worker-shaped stack—fork, tune, and extend instead of a black-box SaaS.",
    },
  ];
</script>

<SEO
  title="filepath | Your agents, your keys, your Cloudflare"
  description="Personal control plane for long-running agents: BYO router keys, harness registry, scoped work on your Cloudflare account."
  keywords="filepath, ai agents, background agents, cloudflare, openrouter, opencode, harnesses"
  path="/"
  type="website"
  section="Product"
  tags="agents,cloudflare,workspaces"
/>

<div class="min-h-screen bg-gray-50 text-gray-900 dark:bg-neutral-950 dark:text-neutral-100">
  <main class="mx-auto max-w-3xl px-6 py-14 md:py-24">
    <section class="border-b border-gray-200 pb-12 dark:border-neutral-800">
      <p class="text-[11px] font-medium uppercase tracking-[0.22em] text-gray-500 dark:text-neutral-500">
        Your cloud · your keys · your harnesses
      </p>
      <h1 class="mt-4 text-3xl font-semibold tracking-tight text-balance md:text-5xl md:leading-[1.1]">
        Orchestrate agents from anywhere.
      </h1>
      <p class="mt-5 text-base leading-7 text-gray-600 dark:text-neutral-400 md:text-lg md:leading-8">
        filepath is a personal control plane for long sessions and parallel work—bounded agents on your own Cloudflare
        stack, with scope you define.
      </p>

      <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button href="/dashboard">Open dashboard</Button>
        <Button href="https://github.com/acoyfellow/filepath" variant="outline" class="rounded-full">
          Source on GitHub
        </Button>
      </div>
    </section>

    <ul class="mt-10 grid gap-8 md:gap-9">
      {#each usps as u (u.id)}
        <li class="border-l-2 border-gray-900 pl-5 dark:border-neutral-100">
          <h2 class="text-sm font-semibold tracking-tight text-gray-900 dark:text-neutral-100">{u.title}</h2>
          <p class="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-neutral-400">{u.line}</p>
        </li>
      {/each}
    </ul>
  </main>
</div>
