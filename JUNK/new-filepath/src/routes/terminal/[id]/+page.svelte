<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { browser } from "$app/environment";

  const sessionId = $derived(page.params.id);
  let ttydUrl = $state<string | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  async function startTerminal() {
    try {
      const res = await fetch(`/api/terminal/${sessionId}/start`, { method: "POST" });
      const data = await res.json();
      if (data.ready && data.url) {
        ttydUrl = data.url;
      } else {
        error = data.error || "Failed to start";
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    if (browser && sessionId) startTerminal();
  });
</script>

<div class="h-screen w-screen bg-black">
  {#if loading}
    <div class="flex h-full items-center justify-center text-white">Starting...</div>
  {:else if error}
    <div class="flex h-full items-center justify-center text-red-500">{error}</div>
  {:else if ttydUrl}
    <iframe src={ttydUrl} class="h-full w-full border-0" title="Terminal" allow="clipboard-read; clipboard-write"></iframe>
  {/if}
</div>
