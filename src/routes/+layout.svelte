<script lang="ts">
  import "../app.css";
  import { setContext } from 'svelte';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { navigating, page } from "$app/state";
  import PreloadingIndicator from "$lib/components/PreloadingIndicator.svelte";
  import Alert from "$lib/components/Alert.svelte";
  import Nav from "$lib/components/Nav.svelte";
  import { initTheme, toggleTheme } from '$lib/theme';

  let { data, children } = $props();

  onMount(() => {
    if (browser) initTheme();
  });

  setContext<{ toggleTheme: () => void }>('theme', { toggleTheme });

  const path = $derived(page.url.pathname);
  const isSession = $derived(/^\/session\/[^/]+/.test(path));
  const isCentered = $derived(['/', '/login', '/signup', '/forgot-password', '/reset-password'].includes(path));
  const variant = $derived(isSession ? 'session' : isCentered ? 'centered' : 'dashboard');
  const current = $derived(path.match(/^\/([^/]+)/)?.[1] ?? null);
  const sessionId = $derived(isSession ? path.split('/')[2] ?? null : null);
</script>

{#if navigating.to}
  <PreloadingIndicator />
{/if}

<div class="min-h-screen flex flex-col bg-white dark:bg-neutral-950 transition-colors duration-200">
  <Nav {variant} {current} {sessionId} />
  <div class="flex-1 min-h-0">
    {@render children?.()}
  </div>
</div>
<Alert />
