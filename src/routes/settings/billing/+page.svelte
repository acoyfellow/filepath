<script lang="ts">
  import { onMount } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  
  // Load data from page.data
  let balance = 0;
  let apiKeys: { id: string; name: string | null; prefix: string; budgetCap: number | null; creditBalance: number | null }[] = [];
  
  onMount(async () => {
    const data = $page.data;
    balance = data.balance;
    apiKeys = data.apiKeys;
  });
  
  // Function to initiate credit purchase
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
      
      // Redirect to Stripe checkout
      window.location.href = url;
    } catch (err) {
      console.error('Error initiating purchase:', err);
    }
  }
  
  // Function to set budget cap for an API key
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
      
      // Refresh data
      invalidateAll();
    } catch (err) {
      console.error('Error setting budget cap:', err);
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-6">Billing & Credits</h1>
  
  <div class="mb-8">
    <h2 class="text-xl font-semibold mb-4">Credit Balance</h2>
    <div class="bg-white rounded-lg shadow p-6 mb-4">
      <p class="text-3xl font-bold text-blue-600">{balance} credits</p>
      <p class="text-gray-600">${(balance * 0.01).toFixed(2)} USD value</p>
    </div>
    
    <h3 class="text-lg font-medium mb-3">Purchase Credits</h3>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <button 
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onclick={() => purchaseCredits(1000)}
      >
        1,000 credits - $10.00
      </button>
      <button 
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onclick={() => purchaseCredits(2500)}
      >
        2,500 credits - $25.00
      </button>
      <button 
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onclick={() => purchaseCredits(5000)}
      >
        5,000 credits - $50.00
      </button>
    </div>
    <p class="text-sm text-gray-600">Minimum purchase: 1,000 credits ($10.00)</p>
  </div>
  
  <div>
    <h2 class="text-xl font-semibold mb-4">API Keys & Budgets</h2>
    {#if apiKeys.length > 0}
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white rounded-lg shadow">
          <thead>
            <tr class="bg-gray-100">
              <th class="py-2 px-4 text-left">Name</th>
              <th class="py-2 px-4 text-left">Key</th>
              <th class="py-2 px-4 text-left">Credits</th>
              <th class="py-2 px-4 text-left">Budget Cap</th>
              <th class="py-2 px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each apiKeys as apiKey}
              <tr class="border-b">
                <td class="py-2 px-4">{apiKey.name || 'Unnamed Key'}</td>
                <td class="py-2 px-4 font-mono text-sm">
                  {apiKey.prefix}
                </td>
                <td class="py-2 px-4">{apiKey.creditBalance !== null ? `${apiKey.creditBalance} credits` : 'N/A'}</td>
                <td class="py-2 px-4">
                  {apiKey.budgetCap !== null ? `${apiKey.budgetCap} credits` : 'No cap'}
                </td>
                <td class="py-2 px-4">
                  <button 
                    class="text-blue-500 hover:text-blue-700 mr-2"
                    onclick={() => setBudgetCap(apiKey.id, 1000)}
                  >
                    Set 1k Cap
                  </button>
                  <button 
                    class="text-blue-500 hover:text-blue-700"
                    onclick={() => setBudgetCap(apiKey.id, null)}
                  >
                    Remove Cap
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="text-gray-600">You don't have any API keys yet.</p>
    {/if}
  </div>
</div>