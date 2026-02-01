<script lang="ts">
</script>

<svelte:head>
  <title>myfilepath.com</title>
  <meta name="description" content="Where agents persist. Runs survive context limits. Artifacts remain. Recovery is expected." />
</svelte:head>

<div class="min-h-screen bg-neutral-950 text-neutral-300 font-sans">
  <!-- Nav -->
  <nav class="border-b border-neutral-800 px-6 py-4 flex justify-between items-center">
    <a href="/" class="flex items-center gap-2">
      <svg width="24" height="24" viewBox="0 0 339 339" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M119.261 35C128.462 35.0001 137.256 38.8378 143.569 45.6083L160.108 63.3453C166.421 70.1159 175.215 73.9536 184.416 73.9536H298.583C317.039 73.9536 332 89.0902 332 107.762V270.191C332 288.863 317.039 304 298.583 304H41.417C22.9613 304 8 288.863 8 270.191V68.8087C8.0001 50.1368 22.9614 35 41.417 35H119.261ZM169.23 219.37V259.415H291.318V219.37H169.23ZM50.7361 111.182L110.398 171.838L51.027 226.311L79.9846 258.994L169.77 173.606L82.022 81.2961L50.7361 111.182Z" fill="currentColor"/>
      </svg>
      <span class="text-neutral-100 font-medium">myfilepath.com</span>
    </a>
    <div class="flex gap-6 text-sm">
      <a href="/docs" class="hover:text-neutral-100">docs</a>
      <a href="/pricing" class="hover:text-neutral-100">pricing</a>
      <a href="/login" class="hover:text-neutral-100">login</a>
    </div>
  </nav>

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
  <footer class="border-t border-neutral-800 px-6 py-6 text-center text-neutral-600 text-xs font-mono">
    myfilepath.com
  </footer>
</div>
