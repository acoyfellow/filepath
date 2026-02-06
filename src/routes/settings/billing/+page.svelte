<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import Nav from '$lib/components/Nav.svelte';
  
  let balance = 0;
  let apiKeys: { id: string; name: string | null; prefix: string; budgetCap: number | null; creditBalance: number | null }[] = [];
  
  onMount(async () => {
    const data = $page.data;
    balance = data.balance;
    apiKeys = data.apiKeys;
  });
  
  async function purchaseCredits(amount: number) {
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ creditAmount: amount }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }
      
      const { url } = await response.json() as { url: string };
      
      if (!url) {
        console.error('No checkout URL returned');
        return;
      }
      
      window.location.href = url;
    } catch (err) {
      console.error('Error initiating purchase:', err);
    }
  }
  
  async function setBudgetCap(apiKeyId: string, cap: number | null) {
    try {
      const response = await fetch(`/api/billing/apikey/${apiKeyId}/budget`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ budgetCap: cap }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to set budget cap');
      }
      
      invalidateAll();
    } catch (err) {
      console.error('Error setting budget cap:', err);
    }
  }
</script>

<div class="min-h-screen bg-neutral-950 text-neutral-300">
  <Nav variant="dashboard" current="billing" email={($page).data?.user?.email} />

  <main class="max-w-3xl mx-auto px-6 py-12">
    <div class="flex items-center justify-between mb-10">
      <div>
        <h1 class="text-neutral-100 text-xl font-medium mb-1">Billing & credits</h1>
        <p class="text-sm text-neutral-500">Manage your balance and spending limits</p>
      </div>
      <a href="/dashboard" class="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded hover:border-neutral-600 transition-colors">← back</a>
    </div>

    <!-- Balance -->
    <section class="mb-10">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Credit balance</h2>
      <div class="bg-neutral-900 border border-neutral-800 rounded p-6">
        <p class="text-3xl text-neutral-100 font-mono font-medium">{balance} <span class="text-neutral-500 text-sm">credits</span></p>
        <p class="text-neutral-500 text-sm mt-1">${(balance * 0.01).toFixed(2)} USD value</p>
      </div>
    </section>

    <!-- Purchase -->
    <section class="mb-10">
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Purchase credits</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button 
          class="bg-neutral-900 border border-neutral-800 rounded p-4 text-left hover:border-neutral-600 transition-colors cursor-pointer group"
          onclick={() => purchaseCredits(1000)}
        >
          <p class="text-neutral-100 font-mono font-medium">1,000</p>
          <p class="text-neutral-500 text-sm">$10.00</p>
        </button>
        <button 
          class="bg-neutral-900 border border-neutral-800 rounded p-4 text-left hover:border-neutral-600 transition-colors cursor-pointer group"
          onclick={() => purchaseCredits(2500)}
        >
          <p class="text-neutral-100 font-mono font-medium">2,500</p>
          <p class="text-neutral-500 text-sm">$25.00</p>
        </button>
        <button 
          class="bg-neutral-900 border border-neutral-800 rounded p-4 text-left hover:border-neutral-600 transition-colors cursor-pointer group"
          onclick={() => purchaseCredits(5000)}
        >
          <p class="text-neutral-100 font-mono font-medium">5,000</p>
          <p class="text-neutral-500 text-sm">$50.00</p>
        </button>
      </div>
      <p class="text-xs text-neutral-600 mt-3">Minimum purchase: 1,000 credits ($10.00)</p>
    </section>

    <!-- API Key Budgets -->
    <section>
      <h2 class="text-neutral-500 text-xs uppercase tracking-wide mb-4">Key budgets</h2>
      {#if apiKeys.length > 0}
        <div class="space-y-3">
          {#each apiKeys as apiKey}
            <div class="bg-neutral-900 border border-neutral-800 rounded p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-neutral-200 font-medium text-sm">{apiKey.name || 'Unnamed Key'}</p>
                  <p class="font-mono text-xs text-neutral-600 mt-1">{apiKey.prefix}</p>
                </div>
                <div class="flex items-center gap-4 text-sm">
                  <div class="text-right">
                    <p class="text-neutral-400 font-mono text-xs">{apiKey.creditBalance !== null ? `${apiKey.creditBalance} credits` : '—'}</p>
                    <p class="text-neutral-600 text-xs">{apiKey.budgetCap !== null ? `cap: ${apiKey.budgetCap}` : 'no cap'}</p>
                  </div>
                  <div class="flex gap-2">
                    <button 
                      class="px-2 py-1 text-xs text-neutral-400 border border-neutral-800 rounded hover:border-neutral-600 transition-colors cursor-pointer"
                      onclick={() => setBudgetCap(apiKey.id, 1000)}
                    >
                      1k cap
                    </button>
                    <button 
                      class="px-2 py-1 text-xs text-neutral-500 border border-neutral-800 rounded hover:border-neutral-600 transition-colors cursor-pointer"
                      onclick={() => setBudgetCap(apiKey.id, null)}
                    >
                      remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="border border-neutral-800 rounded p-6 text-center">
          <p class="text-neutral-500 text-sm">No API keys yet.</p>
          <a href="/settings/api-keys" class="text-neutral-400 text-sm hover:underline mt-1 inline-block">Create one →</a>
        </div>
      {/if}
    </section>
  </main>
</div>
