<script lang="ts">
  import CodeBlock from "$lib/components/CodeBlock.svelte";
  import SEO from "$lib/components/SEO.svelte";

  const heroCode = `const workspace = await fetch("/api/workspaces", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "my-repo",
    gitRepoUrl: "https://github.com/acme/my-repo"
  })
}).then((res) => res.json());

const agent = await fetch(\`/api/workspaces/\${workspace.id}/agents\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "landing-copy-pass",
    harnessId: "codex",
    model: "openai/gpt-5",
    allowedPaths: ["src/routes", "src/lib/components"],
    forbiddenPaths: [".git", "node_modules"],
    toolPermissions: ["search", "run", "write"],
    writableRoot: "src"
  })
}).then((res) => res.json());

console.log(agent.id);`;

  const capabilities = [
    {
      title: "Swappable models",
      body:
        "Model choice is runtime configuration. Change models without changing the agent lifecycle or the dashboard surface.",
    },
    {
      title: "Swappable harnesses",
      body:
        "Codex, Shelley, Cursor, or your own harness all fit into the same agent contract. filepath stays thin and avoids lock-in.",
    },
    {
      title: "Scoped agents",
      body:
        "Every agent is created with explicit file and tool scope so background work stays bounded instead of relying on prompt discipline.",
    },
  ];

  const workflow = [
    "Deploy filepath to your own Cloudflare account.",
    "Sign in with Better Auth and open your dashboard.",
    "Connect a repo into a sandboxed git workspace.",
    "Create an agent with a harness, model, file scope, and tool permissions.",
    "Review logs, diffs, and results from the dashboard or API.",
  ];
</script>

<SEO
  title="filepath | Personal background agents on Cloudflare"
  description="A personal Cloudflare-hosted development environment for bounded background agents against sandboxed repo clones."
  keywords="filepath, ai agents, background agents, cloudflare, sandboxes, workspaces"
  path="/"
  type="website"
  section="Product"
  tags="agents,cloudflare,workspaces"
/>

<div class="min-h-screen bg-gray-50 text-gray-900 dark:bg-neutral-950 dark:text-neutral-100">
  <main class="mx-auto max-w-6xl px-6 py-12 md:py-20">
    <section class="">
      
        <div class="text-[11px] uppercase tracking-[0.28em] text-gray-500 dark:text-neutral-500">
          Cloudflare Agents SDK + Sandboxes
        </div>
        <h1 class="mt-5 text-4xl font-semibold tracking-tight text-balance md:text-6xl">
          Your own background agent environment on Cloudflare.
        </h1>
        <p class="mt-6 max-w-2xl text-base leading-8 text-gray-600 dark:text-neutral-400 md:text-lg">
          filepath is a personal dashboard for spawning bounded background agents against sandboxed repo clones.
          Agents stay configurable, long-running, and scoped by file and tool permissions instead of broad repo access.
        </p>

        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href="/dashboard"
            class="inline-flex items-center justify-center rounded-full bg-gray-900 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
          >
            Open dashboard
          </a>
          <a
            href="https://github.com/acoyfellow/filepath"
            class="inline-flex items-center justify-center rounded-full border border-gray-300 px-6 py-3 font-medium transition-colors hover:border-gray-400 dark:border-neutral-700 dark:hover:border-neutral-500"
          >
            Deploy from GitHub
          </a>
        </div>

        <div class="mt-10 grid gap-4 md:grid-cols-3">
          {#each capabilities as item}
            <article class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900/50">
              <h2 class="font-medium">{item.title}</h2>
              <p class="mt-3 text-sm leading-7 text-gray-600 dark:text-neutral-400">{item.body}</p>
            </article>
          {/each}
        </div>
      

    </section>

  </main>
</div>
