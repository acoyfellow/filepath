<script lang="ts">
  import CodeBlock from '$lib/components/CodeBlock.svelte';
  import HeroDemo from '$lib/components/HeroDemo.svelte';

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

  const truths = [
    {
      eyebrow: 'True Today',
      title: 'Cloudflare sandboxes with real isolation',
      body:
        'Each thread runs inside its own Cloudflare sandbox with its own filesystem and process space. The chat pane is the control surface for a real headless orchestrator, not a fake replay.',
    },
    {
      eyebrow: 'True Today',
      title: 'Supported harnesses, exact models, no extra lock-in',
      body:
        'Choose from the supported harnesses. Use the exact model string your configured router exposes. filepath stays thin and avoids layering a second abstraction on top.',
    },
    {
      eyebrow: 'True Today',
      title: 'Durable session state that reconnects cleanly',
      body:
        'Session state persists and reconnects cleanly. When you come back, you return to the same session tree and history while the runtime is resumed or re-entered when available.',
    },
    {
      eyebrow: 'True Today',
      title: 'Realtime session state across your devices',
      body:
        'A session can be reopened from another device on the same account and streamed live. The tree is your thread filesystem: a visible way to partition work, keep it grouped, and stay oriented.',
    },
    {
      eyebrow: 'True Today',
      title: 'Chat-first runtime visibility',
      body:
        'The selected thread shows durable status, event history, tool calls, commits, and exhaustion markers in chat. The runtime stays headless instead of splitting the product into chat plus a terminal viewer.',
    },
    {
      eyebrow: 'True Today',
      title: 'Move threads like files and folders',
      body:
        'The tree is now an active organizer. You can reparent and reorder running threads, and the session stays coherent while the structure changes around live work.',
    },
  ];

  const roadmap = [
    {
      title: 'More routers, same contract',
      tag: 'Roadmap',
      body:
        'OpenRouter and Zen are the start. More routers and OpenAPI-compatible providers should slot into the same model contract without filepath inventing a second abstraction layer.',
    },
  ];
</script>

<svelte:head>
  <title>filepath — your agents, your models, your Cloudflare</title>
  <meta
    name="description"
    content="Long-running agent sessions on Cloudflare sandboxes, with a clear line between what is true today and what is next."
  />
</svelte:head>

<div class="min-h-screen font-sans relative z-10 transition-colors duration-200 bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300">
  <div class="min-h-screen z-0 absolute inset-0 pointer-events-none transition-colors duration-200 bg-white opacity-5 dark:bg-black dark:opacity-10">
    <img src="/bg.jpg" alt="Background" class="absolute inset-0 w-full h-full object-cover z-0"/>
    <div class="absolute bottom-0 left-0 w-full h-1/2 bg-linear-to-t from-gray-50 dark:from-neutral-950 to-transparent z-10"></div>
  </div>

  <main class="max-w-6xl mx-auto px-6 py-12 md:py-20">
    <section class="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
      <div>
        <div class="text-[11px] uppercase tracking-[0.28em] text-gray-500 dark:text-neutral-500">True Today + Roadmap</div>
        <h1 class="mt-5 text-4xl md:text-6xl font-medium leading-[0.98] tracking-tight text-gray-900 dark:text-neutral-100">
          Your agents. Your models. Your Cloudflare.
        </h1>
        <p class="mt-6 max-w-2xl text-base md:text-lg leading-8 text-gray-600 dark:text-neutral-400">
          filepath runs long-running sessions inside Cloudflare sandboxes. Each thread is a real isolated runtime with its own filesystem. The tree is how you partition the work, like a filesystem for your threads, while the session stays live across your own devices.
        </p>

        <div class="mt-8 flex flex-col sm:flex-row gap-3">
          <a href="/signup" class="inline-flex items-center justify-center px-6 py-3 rounded-full font-medium transition-colors bg-gray-900 hover:bg-gray-800 text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-950">
            Create free account
          </a>
          <a href="/docs" class="inline-flex items-center justify-center px-6 py-3 rounded-full border transition-colors border-gray-300 hover:border-gray-400 dark:border-neutral-700 dark:hover:border-neutral-500">
            Read docs
          </a>
        </div>
      </div>

      <div class="overflow-hidden rounded-3xl border border-gray-200 bg-white/92 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.4)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/88">
        <div class="flex items-center gap-2 border-b border-gray-200 px-5 py-4 dark:border-neutral-800">
          <span class="h-2.5 w-2.5 rounded-full bg-rose-400/80"></span>
          <span class="h-2.5 w-2.5 rounded-full bg-amber-400/80"></span>
          <span class="h-2.5 w-2.5 rounded-full bg-emerald-400/80"></span>
          <span class="ml-3 text-[11px] uppercase tracking-[0.22em] text-gray-500 dark:text-neutral-500">hello-world.ts</span>
        </div>
        <CodeBlock
          code={heroCode}
          language="typescript"
          wrap={true}
          className="overflow-hidden px-5 py-5 text-sm leading-7 text-gray-800 dark:text-neutral-200"
        />
      </div>
    </section>

    <section class="mt-16 md:mt-20 grid gap-4 md:grid-cols-2">
      {#each truths as item}
        <article class="rounded-3xl border border-gray-200 bg-white/84 p-6 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/35">
          <div class="text-[11px] uppercase tracking-[0.24em] text-gray-500 dark:text-neutral-500">{item.eyebrow}</div>
          <h2 class="mt-4 text-xl font-medium text-gray-900 dark:text-neutral-100">{item.title}</h2>
          <p class="mt-4 text-sm leading-7 text-gray-600 dark:text-neutral-400">{item.body}</p>
        </article>
      {/each}
    </section>

    <section class="mt-16 md:mt-20 rounded-3xl border border-gray-200 bg-white/84 p-6 md:p-8 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/35">
      <div class="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <div class="text-[11px] uppercase tracking-[0.24em] text-gray-500 dark:text-neutral-500">How It Works</div>
          <h2 class="mt-4 text-2xl md:text-3xl font-medium tracking-tight text-gray-900 dark:text-neutral-100">
            The UI stays thin. The primitives do the real work.
          </h2>
          <p class="mt-5 text-sm md:text-base leading-8 text-gray-600 dark:text-neutral-400">
            Each thread is a headless orchestrator that hands work to the selected harness and model inside the sandbox. filepath tries to stay out of the way: no fake replay layer, no direct-model bypass, no hidden second execution path.
          </p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-2xl border border-gray-200/90 bg-gray-50/80 p-5 dark:border-neutral-800 dark:bg-neutral-950/60">
            <div class="text-xs uppercase tracking-[0.22em] text-gray-500 dark:text-neutral-500">Each Thread</div>
            <p class="mt-3 text-sm leading-7 text-gray-700 dark:text-neutral-300">
              A thread is a chat surface backed by a sandboxed runtime. The runtime stays headless and reports through the protocol instead of becoming a second UI.
            </p>
          </div>
          <div class="rounded-2xl border border-gray-200/90 bg-gray-50/80 p-5 dark:border-neutral-800 dark:bg-neutral-950/60">
            <div class="text-xs uppercase tracking-[0.22em] text-gray-500 dark:text-neutral-500">The Tree</div>
            <p class="mt-3 text-sm leading-7 text-gray-700 dark:text-neutral-300">
              The tree is your thread filesystem. It is how you isolate, group, and reason about parallel work.
            </p>
          </div>
          <div class="rounded-2xl border border-gray-200/90 bg-gray-50/80 p-5 dark:border-neutral-800 dark:bg-neutral-950/60">
            <div class="text-xs uppercase tracking-[0.22em] text-gray-500 dark:text-neutral-500">Realtime State</div>
            <p class="mt-3 text-sm leading-7 text-gray-700 dark:text-neutral-300">
              Sessions stream live and can be reopened later on the same account. You come back to the same running loop without pretending there is a public share model.
            </p>
          </div>
          <div class="rounded-2xl border border-gray-200/90 bg-gray-50/80 p-5 dark:border-neutral-800 dark:bg-neutral-950/60">
            <div class="text-xs uppercase tracking-[0.22em] text-gray-500 dark:text-neutral-500">Why It Stays Cheap</div>
            <p class="mt-3 text-sm leading-7 text-gray-700 dark:text-neutral-300">
              The edge handles persistence and wake-up. You do not need to keep a full-time box alive just to preserve a session.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="mt-16 md:mt-20">
      <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-[11px] uppercase tracking-[0.24em] text-gray-500 dark:text-neutral-500">Roadmap</div>
          <h2 class="mt-4 text-2xl md:text-3xl font-medium tracking-tight text-gray-900 dark:text-neutral-100">
            What is next
          </h2>
        </div>
        <p class="max-w-2xl text-sm leading-7 text-gray-600 dark:text-neutral-400">
          The roadmap only holds the pieces that are still intentionally deferred. When something becomes real enough to gate, it moves out of this list.
        </p>
      </div>

      <div class="mt-8 grid gap-4 md:grid-cols-1">
        {#each roadmap as item}
          <article class="rounded-3xl border border-dashed border-gray-300 bg-white/72 p-6 dark:border-neutral-700 dark:bg-neutral-900/20">
            <div class="text-[11px] uppercase tracking-[0.24em] text-gray-500 dark:text-neutral-500">{item.tag}</div>
            <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-neutral-100">{item.title}</h3>
            <p class="mt-4 text-sm leading-7 text-gray-600 dark:text-neutral-400">{item.body}</p>
          </article>
        {/each}
      </div>
    </section>

    <section class="mt-16 md:mt-20 rounded-3xl border border-gray-200 bg-white/88 p-6 md:p-8 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/35">
      <div class="mb-6">
        <div class="text-[11px] uppercase tracking-[0.24em] text-gray-500 dark:text-neutral-500">Live Surface</div>
        <h2 class="mt-4 text-2xl md:text-3xl font-medium tracking-tight text-gray-900 dark:text-neutral-100">
          This is the actual session UI, not a separate landing-page toy.
        </h2>
        <p class="mt-4 max-w-3xl text-sm md:text-base leading-8 text-gray-600 dark:text-neutral-400">
          The homepage uses the same tree and panel components as the app. This seed shows a moved nested agent inside the actual interface, so the landing page stays grounded in the literal product surface instead of a fake parallel demo.
        </p>
      </div>

      <div class="@container w-full overflow-hidden rounded-2xl border border-gray-200 bg-white/90 shadow-[0_28px_100px_-40px_rgba(15,23,42,0.45)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <HeroDemo />
      </div>
    </section>
  </main>

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
