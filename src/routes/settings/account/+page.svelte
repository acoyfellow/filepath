<script lang="ts">
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Dialog from '$lib/components/ui/dialog';

  let showDeleteDialog = $state(false);
  let password = $state('');
  let confirmText = $state('');
  let isDeleting = $state(false);
  let error = $state('');

  const CONFIRM_PHRASE = 'delete my account';

  async function handleDelete() {
    if (confirmText.toLowerCase() !== CONFIRM_PHRASE) {
      error = `Please type "${CONFIRM_PHRASE}" to confirm`;
      return;
    }

    isDeleting = true;
    error = '';

    try {
      const response = await authClient.deleteUser({
        password: password || undefined
      });

      if (response.error) {
        error = response.error.message || 'Failed to delete account';
        isDeleting = false;
        return;
      }

      // Account deleted, redirect to homepage
      await goto('/');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete account';
      isDeleting = false;
    }
  }
</script>

<div class="min-h-screen bg-white p-8">
  <div class="max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-black">Account Settings</h1>
        <p class="text-gray-600 mt-1">Manage your account</p>
      </div>
      <a href="/dashboard" class="border border-black px-4 py-2 hover:bg-gray-100">
        ← Back
      </a>
    </div>

    <div class="border-2 border-black p-6 mb-8">
      <h2 class="text-xl font-bold mb-4">Account Information</h2>
      <p class="text-gray-600">Your account details are managed through your profile settings.</p>
    </div>

    <div class="border-2 border-red-500 p-6">
      <h2 class="text-xl font-bold text-red-600 mb-4">Danger Zone</h2>
      <p class="text-gray-600 mb-4">
        Permanently delete your account and all associated data. This action cannot be undone.
      </p>
      <Button 
        variant="destructive" 
        onclick={() => showDeleteDialog = true}
      >
        Delete Account
      </Button>
    </div>
  </div>
</div>

<Dialog.Root bind:open={showDeleteDialog}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="text-red-600">Delete Account</Dialog.Title>
      <Dialog.Description>
        This will permanently delete your account and all data including:
        <ul class="list-disc ml-6 mt-2 text-sm">
          <li>All sessions and terminals</li>
          <li>All API keys</li>
          <li>Credit balance (non-refundable)</li>
          <li>Usage history</li>
        </ul>
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <div class="space-y-2">
        <Label for="password">Password (if recently logged in, may be optional)</Label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          bind:value={password}
        />
      </div>

      <div class="space-y-2">
        <Label for="confirm">Type "{CONFIRM_PHRASE}" to confirm</Label>
        <Input
          id="confirm"
          type="text"
          placeholder={CONFIRM_PHRASE}
          bind:value={confirmText}
        />
      </div>

      {#if error}
        <p class="text-red-500 text-sm">{error}</p>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => showDeleteDialog = false}>
        Cancel
      </Button>
      <Button 
        variant="destructive" 
        onclick={handleDelete}
        disabled={isDeleting || confirmText.toLowerCase() !== CONFIRM_PHRASE}
      >
        {isDeleting ? 'Deleting...' : 'Delete My Account'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
