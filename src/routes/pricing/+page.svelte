<script lang="ts">
</script>

<svelte:head>
  <title>Pricing - myfilepath.com</title>
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
      <a href="/pricing" class="text-neutral-100">pricing</a>
      <a href="/login" class="hover:text-neutral-100">login</a>
    </div>
  </nav>

  <main class="max-w-2xl mx-auto px-6 py-12">
    <h1 class="text-neutral-100 text-xl font-medium mb-8">Pricing</h1>

    <!-- Simple pricing -->
    <section class="mb-12">
      <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-8">
        <div class="text-center mb-8">
          <div class="text-4xl font-medium text-neutral-100 font-mono mb-2">$0.01<span class="text-lg text-neutral-500">/min</span></div>
          <p class="text-neutral-500">Active compute time</p>
        </div>
        
        <div class="space-y-3 text-sm">
          <div class="flex justify-between py-2 border-b border-neutral-800">
            <span>Active container</span>
            <span class="font-mono text-neutral-100">$0.01/min</span>
          </div>
          <div class="flex justify-between py-2 border-b border-neutral-800">
            <span>Idle container (sleeping)</span>
            <span class="font-mono text-neutral-100">$0.00/min</span>
          </div>
          <div class="flex justify-between py-2 border-b border-neutral-800">
            <span>Storage (filesystem)</span>
            <span class="font-mono text-neutral-100">Included</span>
          </div>
          <div class="flex justify-between py-2 border-b border-neutral-800">
            <span>Network egress</span>
            <span class="font-mono text-neutral-100">Included</span>
          </div>
          <div class="flex justify-between py-2">
            <span>API calls</span>
            <span class="font-mono text-neutral-100">Included</span>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="mb-12">
      <h2 class="text-neutral-100 text-lg mb-4">How billing works</h2>
      <div class="space-y-4 text-sm text-neutral-400">
        <p><span class="text-neutral-100">Prepaid credits.</span> Load credits to your account. $10 minimum = 1000 minutes.</p>
        <p><span class="text-neutral-100">Human controls spend.</span> API keys can have budget caps. No surprise bills.</p>
        <p><span class="text-neutral-100">Container sleeps when idle.</span> No charge when not actively computing. Wake time ~2s.</p>
        <p><span class="text-neutral-100">Per-second billing.</span> Only pay for what you use, rounded to the second.</p>
      </div>
    </section>

    <!-- Example -->
    <section class="mb-12">
      <h2 class="text-neutral-100 text-lg mb-4">Example</h2>
      <div class="bg-neutral-900 border border-neutral-800 rounded p-4 text-sm">
        <table class="w-full">
          <tbody>
            <tr class="border-b border-neutral-800">
              <td class="py-2 text-neutral-400">Agent runs for 45 minutes</td>
              <td class="py-2 font-mono text-right">$0.45</td>
            </tr>
            <tr class="border-b border-neutral-800">
              <td class="py-2 text-neutral-400">Sleeps for 6 hours</td>
              <td class="py-2 font-mono text-right">$0.00</td>
            </tr>
            <tr class="border-b border-neutral-800">
              <td class="py-2 text-neutral-400">Wakes, runs for 30 minutes</td>
              <td class="py-2 font-mono text-right">$0.30</td>
            </tr>
            <tr>
              <td class="py-2 text-neutral-100">Total</td>
              <td class="py-2 font-mono text-right text-neutral-100">$0.75</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Limits -->
    <section class="mb-12">
      <h2 class="text-neutral-100 text-lg mb-4">Limits</h2>
      <div class="space-y-2 text-sm text-neutral-500">
        <p>• 2GB RAM per container</p>
        <p>• 10GB storage per session</p>
        <p>• Container sleeps after 5min idle</p>
        <p>• No GPU (yet)</p>
      </div>
    </section>

    <!-- CTA -->
    <section class="border-t border-neutral-800 pt-8">
      <a href="/login" class="text-neutral-100 hover:underline">→ Get started</a>
    </section>
  </main>

  <footer class="border-t border-neutral-800 px-6 py-6 text-center text-neutral-600 text-xs font-mono">
    myfilepath.com
  </footer>
</div>
