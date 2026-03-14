<script lang="ts">
  import "../app.css";
  import "$lib/styles/theme.css";
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
  const isWorkspace = $derived(/^\/workspace\/[^/]+/.test(path));
  const isCentered = $derived(['/', '/login', '/signup', '/forgot-password', '/reset-password'].includes(path));
  const variant = $derived(isWorkspace ? 'workspace' : isCentered ? 'centered' : 'dashboard');
  const current = $derived(path.match(/^\/([^/]+)/)?.[1] ?? null);
  const workspaceId = $derived(isWorkspace ? path.split('/')[2] ?? null : null);
</script>

{#if navigating.to}
  <PreloadingIndicator />
{/if}

<div class="min-h-screen flex flex-col bg-(--bg) text-(--t2) transition-colors duration-200 {isWorkspace ? 'h-dvh overflow-hidden' : ''}">
  <Nav {variant} {current} {workspaceId} />
  <div class="flex-1 min-h-0 {isWorkspace ? 'overflow-hidden' : ''}">
    {@render children?.()}
  </div>
</div>
<Alert />
