<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
</script>

<svelte:head>
  <title>Pricing - myfilepath.com</title>
</svelte:head>

<div class="min-h-screen bg-neutral-950 text-neutral-300 font-sans">
  <Nav variant="centered" />

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
