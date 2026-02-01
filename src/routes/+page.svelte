<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
</script>

<svelte:head>
  <title>myfilepath.com</title>
  <meta name="description" content="Where agents persist. Runs survive context limits. Artifacts remain. Recovery is expected." />
</svelte:head>



<div class="min-h-screen bg-neutral-950 text-neutral-300 font-sans relative z-10">
  <div class="bg-black min-h-screen  z-0 absolute inset-0 opacity-10">
  <img src="/bg.jpg" alt="Background" class="absolute inset-0 w-full h-full object-cover z-0"/>
  <div class="absolute bottom-0 left-0 w-full h-1/2 bg-linear-to-t from-neutral-950 to-transparent z-10"></div>
</div>

  <Nav variant="centered" />

  <!-- Hero -->
  <main class="max-w-2xl mx-auto px-6 py-20">
    <h1 class="text-neutral-100 text-2xl font-medium mb-4">Where agents persist.</h1>
    
    <p class="mb-12 leading-relaxed text-lg text-neutral-400">
      Runs survive context limits. Artifacts remain. Recovery is expected.<br/>
      <span class="text-neutral-500">Humans supervise. Agents operate.</span>
    </p>

    <!-- Guarantees -->
    <section class="mb-12">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Guarantees</h2>
      <ul class="space-y-3 text-sm">
        <li class="flex gap-3">
          <span class="text-neutral-600">→</span>
          <span>Stateful execution resumes automatically after interruption</span>
        </li>
        <li class="flex gap-3">
          <span class="text-neutral-600">→</span>
          <span>Artifacts have explicit addresses and persist indefinitely</span>
        </li>
        <li class="flex gap-3">
          <span class="text-neutral-600">→</span>
          <span>Recovery is expected, not exceptional</span>
        </li>
        <li class="flex gap-3">
          <span class="text-neutral-600">→</span>
          <span>Container state survives human context limits</span>
        </li>
      </ul>
    </section>

    <!-- Agent Interfaces -->
    <section class="mb-12">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Agent Interfaces</h2>
      <p class="text-sm text-neutral-500 mb-4">MCP-first. API-native. UI optional.</p>
      <div class="bg-neutral-900 border border-neutral-800 rounded p-4 text-sm overflow-x-auto">
        <pre class="text-neutral-400 font-mono text-xs"># Session survives context limits
POST /session/abc-123/exec
Body: &lcub;command: "npm test"&rcub;

# 3 hours later, same session
POST /session/abc-123/exec
Body: &lcub;command: "cat test-results.json"&rcub;

# Artifacts have addresses
GET /session/abc-123/files/coverage/</pre>
      </div>
    </section>

    <!-- Execution Environment -->
    <section class="mb-12">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Execution Environment</h2>
      <ul class="space-y-2 text-sm">
        <li>• Linux containers with full shell access <span class="text-neutral-600 font-mono">(bash, git, npm, python)</span></li>
        <li>• Filesystem persists across execution contexts</li>
        <li>• Background processes and long-running jobs</li>
        <li>• Health checks and automatic recovery</li>
        <li>• Handoff protocol for context window limits</li>
      </ul>
    </section>

    <!-- Pricing -->
    <section class="mb-12">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Pricing</h2>
      <div class="text-sm space-y-2">
        <p><span class="text-neutral-100 font-mono">$0.01/min</span> while executing</p>
        <p><span class="text-neutral-100 font-mono">$0.00/min</span> while idle (container sleeps)</p>
        <p class="text-neutral-500 text-xs">Prepaid credits. Human approves spend threshold.</p>
      </div>
    </section>

    <!-- Boundaries -->
    <section class="mb-12">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Boundaries</h2>
      <ul class="space-y-1 text-sm text-neutral-500">
        <li>• No GPU (yet)</li>
        <li>• 2GB RAM per container</li>
        <li>• Cloudflare network egress</li>
        <li>• Sleep after 5min idle (state preserved)</li>
      </ul>
    </section>

    <!-- CTA -->
    <section class="border-t border-neutral-800 pt-8">
      <a href="/login" class="text-neutral-100 hover:underline">→ Start executing</a>
      <span class="text-neutral-600 ml-4">or</span>
      <a href="/docs" class="text-neutral-400 hover:underline ml-2">read the spec</a>
    </section>
  </main>

  <!-- Footer -->
  <footer class="border-t border-neutral-800 px-6 py-6 text-center text-neutral-600 text-xs font-mono space-y-2">
    <div>myfilepath.com</div>
    <div class="text-neutral-500">
      <a href="https://github.com/acoyfellow/filepath" class="hover:text-neutral-300 transition-colors">Open source on GitHub</a>
      <span class="mx-2">•</span>
      <span>Hosted: $0.01/min while executing</span>
    </div>
  </footer>
</div>
