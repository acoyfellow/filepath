<script lang="ts">
  import "../app.css";
  import { navigating } from "$app/state";
  import PreloadingIndicator from "$lib/components/PreloadingIndicator.svelte";
  import Alert from "$lib/components/Alert.svelte";

  let { children } = $props();
</script>

{#if navigating.to}
  <PreloadingIndicator />
{/if}

{@render children?.()}

<Alert />
