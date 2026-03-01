<script lang="ts">
  import CodeBlock from '$lib/components/CodeBlock.svelte';

  const heroCode = `const session = await fetch("/api/sessions", {
  method: "POST",
  body: JSON.stringify({ name: "hello-world" })
}).then((res) => res.json());

await fetch(\`/api/sessions/\${session.id}/nodes\`, {
  method: "POST",
  body: JSON.stringify({
    name: "ship-it",
    agentType: "codex",
    model: "openai/gpt-5"
  })
});

const status = await fetch(\`/api/sessions/\${session.id}/status\`)
  .then((res) => res.json());

console.log(status.summary.running > 0); // true`;
</script>

<svelte:head>
  <title>filepath — agents that keep running</title>
  <meta name="description" content="Start an agent, close the tab, come back later. filepath keeps the session alive." />
</svelte:head>

<div class="min-h-screen font-sans relative z-10 transition-colors duration-200 bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300">
  <div class="min-h-screen z-0 absolute inset-0 pointer-events-none transition-colors duration-200 bg-white opacity-5 dark:bg-black dark:opacity-10">
    <img src="/bg.jpg" alt="Background" class="absolute inset-0 w-full h-full object-cover z-0"/>
    <div class="absolute bottom-0 left-0 w-full h-1/2 bg-linear-to-t from-gray-50 dark:from-neutral-950 to-transparent z-10"></div>
  </div>

  <main class="max-w-6xl mx-auto px-6 py-12 md:py-20">
    <!-- Hero: headline, subhead, and the code -->
    <section class="mb-16">
      <div class="mx-auto max-w-4xl">
        <h1 class="text-3xl md:text-5xl font-medium leading-tight tracking-tight text-gray-900 dark:text-neutral-100">
          Agents that keep running.
        </h1>

        <p class="mt-4 max-w-2xl text-base md:text-lg leading-relaxed text-gray-600 dark:text-neutral-400">
          Start one. Close the tab. Come back later. filepath keeps the work alive.
        </p>
      </div>

      <div class="mx-auto mt-8 max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white/90 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <div class="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-neutral-800">
          <span class="h-2.5 w-2.5 rounded-full bg-rose-400/80"></span>
          <span class="h-2.5 w-2.5 rounded-full bg-amber-400/80"></span>
          <span class="h-2.5 w-2.5 rounded-full bg-emerald-400/80"></span>
          <span class="ml-3 text-[11px] uppercase tracking-[0.22em] text-gray-500 dark:text-neutral-500">hello-world.ts</span>
        </div>

        <CodeBlock
          code={heroCode}
          language="typescript"
          wrap={true}
          className="overflow-hidden px-4 py-5 text-sm leading-7 text-gray-800 dark:text-neutral-200 sm:px-6 sm:py-6"
        />
      </div>
    </section>

    <!-- What You Get: Three Things -->
    <section class="mb-16">
      <h2 class="text-xs uppercase tracking-wide mb-6 text-gray-500 dark:text-neutral-500">What you get</h2>
      <div class="grid md:grid-cols-3 gap-5">
        <div class="rounded-lg p-5 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <h3 class="font-medium mb-2 text-gray-900 dark:text-neutral-200">Visual Tree</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">See every agent's status at a glance. Hierarchy shows who's working on what. Click any node to chat.</p>
        </div>
        <div class="rounded-lg p-5 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <h3 class="font-medium mb-2 text-gray-900 dark:text-neutral-200">Rich Chat</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Watch tool calls, file writes, commits, and spawned agents appear inline. Real-time via WebSocket.</p>
        </div>
        <div class="rounded-lg p-5 border bg-white border-gray-200 dark:bg-neutral-900/50 dark:border-neutral-800">
          <h3 class="font-medium mb-2 text-gray-900 dark:text-neutral-200">Persistent State</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Close your laptop, reopen on your phone — same tree, same conversations. Agents keep working.</p>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="mb-16">
      <h2 class="text-xs uppercase tracking-wide mb-6 text-gray-500 dark:text-neutral-500">How it works</h2>
      <div class="grid md:grid-cols-4 gap-4">
        <div>
          <div class="text-2xl font-medium mb-2 text-gray-300 dark:text-neutral-700">01</div>
          <h3 class="font-medium mb-1 text-gray-900 dark:text-neutral-200">Create Session</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Like a project folder. Optional git repo to clone.</p>
        </div>
        <div>
          <div class="text-2xl font-medium mb-2 text-gray-300 dark:text-neutral-700">02</div>
          <h3 class="font-medium mb-1 text-gray-900 dark:text-neutral-200">Spawn Agent</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Pick type, model, give it a name. Appears in tree.</p>
        </div>
        <div>
          <div class="text-2xl font-medium mb-2 text-gray-300 dark:text-neutral-700">03</div>
          <h3 class="font-medium mb-1 text-gray-900 dark:text-neutral-200">Chat & Watch</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Send tasks. Watch code, commits, spawned helpers in real-time.</p>
        </div>
        <div>
          <div class="text-2xl font-medium mb-2 text-gray-300 dark:text-neutral-700">04</div>
          <h3 class="font-medium mb-1 text-gray-900 dark:text-neutral-200">Tree Grows</h3>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Agents spawn child agents. Workflow branches automatically.</p>
        </div>
      </div>
    </section>

    <!-- BYOK -->
    <section class="mb-16 rounded-lg p-6 border bg-white border-gray-200 dark:bg-neutral-900/30 dark:border-neutral-800">
      <h2 class="text-xs uppercase tracking-wide mb-4 text-gray-500 dark:text-neutral-500">Bring Your Own Key</h2>
      <div class="grid md:grid-cols-2 gap-6">
        <div>
          <p class="mb-2 text-gray-900 dark:text-neutral-300">Your router key = your compute spend. No markup.</p>
          <p class="text-sm text-gray-600 dark:text-neutral-400">Bring OpenRouter or OpenCode Zen. Save one or both, then pick the router with your model string.</p>
        </div>
        <div class="flex flex-col justify-center">
          <a href="https://openrouter.ai/keys" class="text-sm transition-colors mb-1 text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-300" target="_blank">
            OpenRouter keys
          </a>
          <a href="https://opencode.ai/zen" class="text-sm transition-colors mb-1 text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-300" target="_blank">
            OpenCode Zen
          </a>
          <span class="text-xs text-gray-500 dark:text-neutral-600">Then validate and save it in Settings → Account</span>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="text-center py-12 border-t border-gray-200 dark:border-neutral-800">
      <h2 class="text-xl mb-4 text-gray-900 dark:text-neutral-200">Ready to orchestrate?</h2>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <a href="/signup" class="inline-flex items-center justify-center px-6 py-3 rounded font-medium transition-colors bg-gray-900 hover:bg-gray-800 text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-950">
          Create free account
        </a>
        <a href="/agent-api" class="inline-flex items-center justify-center px-6 py-3 border rounded transition-colors border-gray-300 hover:border-gray-400 dark:border-neutral-700 dark:hover:border-neutral-500">
          API for agents
        </a>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="px-6 py-8 text-center text-xs border-t border-gray-200 text-gray-500 dark:border-neutral-800 dark:text-neutral-600">
    <div class="mb-2">myfilepath.com</div>
    <div class="space-x-3">
      <a href="https://github.com/acoyfellow/filepath" class="hover:underline hover:text-gray-900 dark:hover:text-neutral-300">GitHub</a>
      <span class="text-gray-300 dark:text-neutral-700">·</span>
      <a href="/docs" class="hover:underline hover:text-gray-900 dark:hover:text-neutral-300">Docs</a>
      <span class="text-gray-300 dark:text-neutral-700">·</span>
      <a href="/api/openapi.json" class="hover:underline hover:text-gray-900 dark:hover:text-neutral-300">API</a>
    </div>
  </footer>
</div>
