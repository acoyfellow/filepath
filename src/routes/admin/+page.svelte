<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  
  let users = $state<Array<{ id: string; email: string; name: string | null; role: string; createdAt: Date }>>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  
  onMount(async () => {
    // Check if user is admin
    if (!page.data.user || page.data.user.role !== 'admin') {
      goto('/');
      return;
    }
    
    // Load users
    await loadUsers();
  });
  
  async function loadUsers() {
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Failed to load users');
      }
      
      const result = await response.json() as { users: typeof users };
      users = result.users || [];
      isLoading = false;
    } catch (err) {
      console.error('Error loading users:', err);
      error = 'Failed to load users';
      isLoading = false;
    }
  }
  
  async function impersonateUser(userId: string) {
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to impersonate user');
      }
      
      // Refresh the page to apply impersonation
      window.location.reload();
    } catch (err) {
      console.error('Error impersonating user:', err);
      error = 'Failed to impersonate user';
    }
  }
</script>

<svelte:head>
  <title>Admin Panel - myfilepath.com</title>
</svelte:head>

<div class="min-h-screen bg-white p-8">
  <header class="mb-8">
    <h1 class="text-3xl font-black mb-2">ADMIN PANEL</h1>
    <p class="text-gray-600">User management and system administration</p>
  </header>
  
  {#if error}
    <div class="bg-red-50 border-4 border-red-500 p-4 mb-6">
      <p class="text-red-700 font-bold">{error}</p>
    </div>
  {/if}
  
  <div class="mb-8">
    <h2 class="text-2xl font-black mb-4">USERS</h2>
    
    {#if isLoading}
      <div class="text-center py-12">
        <div class="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="mt-4 text-gray-600">Loading users...</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white border-4 border-black">
          <thead>
            <tr class="bg-gray-100">
              <th class="py-2 px-4 text-left">Name</th>
              <th class="py-2 px-4 text-left">Email</th>
              <th class="py-2 px-4 text-left">Role</th>
              <th class="py-2 px-4 text-left">Created</th>
              <th class="py-2 px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each users as user (user.id)}
              <tr class="border-b border-gray-200">
                <td class="py-2 px-4">{user.name || 'No name'}</td>
                <td class="py-2 px-4">{user.email}</td>
                <td class="py-2 px-4">
                  <span class="px-2 py-1 text-xs font-bold bg-gray-200 rounded">
                    {user.role}
                  </span>
                </td>
                <td class="py-2 px-4 text-sm text-gray-600">
                  {user.createdAt.toLocaleDateString()}
                </td>
                <td class="py-2 px-4">
                  <button 
                    onclick={() => impersonateUser(user.id)}
                    class="text-xs font-black px-3 py-1 border-2 border-black hover:bg-black hover:text-white"
                  >
                    IMPERSONATE
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
  
  <div>
    <h2 class="text-2xl font-black mb-4">SYSTEM ACTIONS</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="border-4 border-black p-6">
        <h3 class="text-xl font-black mb-2">BILLING</h3>
        <p class="text-gray-700 mb-4">Manage user credits and billing issues</p>
        <button class="px-4 py-2 font-black border-4 border-black hover:bg-black hover:text-white">
          VIEW BILLING
        </button>
      </div>
      <div class="border-4 border-black p-6">
        <h3 class="text-xl font-black mb-2">SESSIONS</h3>
        <p class="text-gray-700 mb-4">Monitor active sessions and terminals</p>
        <button class="px-4 py-2 font-black border-4 border-black hover:bg-black hover:text-white">
          VIEW SESSIONS
        </button>
      </div>
      <div class="border-4 border-black p-6">
        <h3 class="text-xl font-black mb-2">SETTINGS</h3>
        <p class="text-gray-700 mb-4">System configuration and maintenance</p>
        <button class="px-4 py-2 font-black border-4 border-black hover:bg-black hover:text-white">
          SYSTEM SETTINGS
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
</style>
