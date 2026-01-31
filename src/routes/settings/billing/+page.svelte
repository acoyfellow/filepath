<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  let balance = $state(0);
  let apiKeys = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let creditsToBuy = $state(1000);
  let selectedApiKey = $state('');
  let budgetCap = $state('');

  onMount(async () => {
    if (!page.data.user) {
      goto('/');
      return;
    }
    await loadBillingInfo();
  });

  async function loadBillingInfo() {
    isLoading = true;
    try {
      const response = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getBalance' })
      });
      
      if (!response.ok) throw new Error('Failed to load billing info');
      
      const data = await response.json();
      balance = data.balance;
      apiKeys = data.apiKeys;
      
      if (apiKeys.length > 0) {
        selectedApiKey = apiKeys[0].id;
      }
    } catch (e) {
      error = 'Failed to load billing information';
    } finally {
      isLoading = false;
    }
  }

  async function purchaseCredits() {
    if (creditsToBuy < 1000) {
      error = 'Minimum 1000 credits required';
      return;
    }

    try {
      const response = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'purchaseCredits',
          credits: creditsToBuy
        })
      });
      
      if (!response.ok) throw new Error('Failed to create checkout session');
      
      const data = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (e) {
      error = 'Failed to initiate purchase';
    }
  }

  async function setBudgetCap() {
    if (!selectedApiKey || !budgetCap) {
      error = 'Please select an API key and enter a budget cap';
      return;
    }

    const cap = parseInt(budgetCap, 10);
    if (isNaN(cap) || cap < 0) {
      error = 'Please enter a valid budget cap';
      return;
    }

    try {
      const response = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'setBudgetCap',
          apiKeyId: selectedApiKey,
          budgetCap: cap
        })
      });
      
      if (!response.ok) throw new Error('Failed to set budget cap');
      
      // Reload billing info
      await loadBillingInfo();
      budgetCap = '';
      
      error = null;
    } catch (e) {
      error = 'Failed to set budget cap';
    }
  }
</script>

<svelte:head>
  <title>Billing - myfilepath.com</title>
</svelte:head>

<div class="min-h-screen bg-white p-8">
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-black">Billing</h1>
        <p class="text-gray-600 mt-1">Manage your credits and API key budgets</p>
      </div>
      <Button variant="outline" onclick={() => goto('/settings')}>
        ← Back to Settings
      </Button>
    </div>

    {#if error}
      <div class="bg-red-50 border-4 border-red-500 p-4 mb-6">
        <p class="text-red-700 font-bold">{error}</p>
        <button onclick={() => error = null} class="text-red-500 underline text-sm">Dismiss</button>
      </div>
    {/if}

    {#if isLoading}
      <div class="text-center py-12">
        <div class="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="mt-4 text-gray-600">Loading billing information...</p>
      </div>
    {:else}
      <div class="space-y-8">
        <!-- Credit Balance -->
        <Card.Root class="border-4 border-black">
          <Card.Header>
            <Card.Title class="text-2xl font-black">Credit Balance</Card.Title>
          </Card.Header>
          <Card.Content>
            <div class="text-4xl font-bold mb-4">{balance} credits</div>
            <p class="text-gray-600 mb-6">
              ${Math.floor(balance / 100)}.{String(balance % 100).padStart(2, '0')} balance
              ($0.01 per minute of compute time)
            </p>
            
            <div class="flex items-end gap-4">
              <div class="flex-1">
                <Label for="credits">Credits to Purchase</Label>
                <select 
                  id="credits" 
                  bind:value={creditsToBuy}
                  class="w-full border-2 border-black p-2 mt-1"
                >
                  <option value="1000">1,000 credits - $10.00 (Minimum)</option>
                  <option value="5000">5,000 credits - $50.00</option>
                  <option value="10000">10,000 credits - $100.00</option>
                  <option value="25000">25,000 credits - $250.00</option>
                  <option value="50000">50,000 credits - $500.00</option>
                </select>
                <p class="text-sm text-gray-500 mt-1">Minimum $10 purchase (1,000 credits)</p>
              </div>
              <Button onclick={purchaseCredits} class="h-12">
                Purchase Credits
              </Button>
            </div>
          </Card.Content>
        </Card.Root>

        <!-- API Key Budgets -->
        <Card.Root class="border-4 border-black">
          <Card.Header>
            <Card.Title class="text-2xl font-black">API Key Budgets</Card.Title>
          </Card.Header>
          <Card.Content>
            <p class="text-gray-600 mb-6">
              Set budget caps for your API keys to prevent unexpected charges.
              Each key can be limited to a maximum number of credits.
            </p>
            
            {#if apiKeys.length === 0}
              <p class="text-gray-500">No API keys found. Create one in the API Keys section.</p>
            {:else}
              <div class="space-y-4">
                <div class="flex items-end gap-4">
                  <div class="flex-1">
                    <Label for="apiKey">API Key</Label>
                    <select 
                      id="apiKey" 
                      bind:value={selectedApiKey}
                      class="w-full border-2 border-black p-2 mt-1"
                    >
                      {#each apiKeys as key}
                        <option value={key.id}>{key.name || key.id}</option>
                      {/each}
                    </select>
                  </div>
                  
                  <div class="flex-1">
                    <Label for="budgetCap">Budget Cap (credits)</Label>
                    <Input 
                      id="budgetCap" 
                      type="number" 
                      bind:value={budgetCap}
                      placeholder="e.g., 10000"
                      class="border-2 border-black mt-1"
                    />
                  </div>
                  
                  <Button onclick={setBudgetCap} class="h-12">
                    Set Cap
                  </Button>
                </div>
                
                <div class="mt-6">
                  <h3 class="font-bold mb-2">API Key Usage</h3>
                  <div class="space-y-3">
                    {#each apiKeys as key}
                      <div class="border border-gray-200 p-3 rounded">
                        <div class="font-medium">{key.name || key.id}</div>
                        <div class="text-sm text-gray-600">
                          Used: {key.totalUsageMinutes} minutes ({key.creditBalance} credits)
                          {#if key.budgetCap}
                            <span class="ml-2">Cap: {key.budgetCap} credits</span>
                          {/if}
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2 mt-2">
                          <div 
                            class="bg-black h-2 rounded-full" 
                            style="width: {key.budgetCap ? Math.min(100, (key.creditBalance / key.budgetCap) * 100) : 0}%"
                          ></div>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      </div>
    {/if}
  </div>
</div>
