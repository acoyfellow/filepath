<script lang="ts">
  import { browser } from '$app/environment';

  type SupportedLanguage = 'bash' | 'javascript' | 'typescript' | 'python' | 'json' | 'svelte';

  interface Props {
    code: string;
    language: SupportedLanguage;
    className?: string;
  }

  let { code, language, className = 'bg-neutral-950 border border-neutral-800 rounded p-4 text-sm text-neutral-300 overflow-x-auto' }: Props = $props();

  let highlightedHtml = $state('');

  async function highlight() {
    if (!browser) {
      return;
    }

    const { codeToHtml } = await import('shiki/bundle/web');

    highlightedHtml = await codeToHtml(code, {
      lang: language,
      theme: 'github-dark-dimmed'
    });
  }

  $effect(() => {
    if (!browser) {
      return;
    }

    void code;
    void language;
    void highlight();
  });
</script>

<div class={className}>
  {#if highlightedHtml}
    {@html highlightedHtml}
  {:else}
    <pre>{code}</pre>
  {/if}
</div>

<style>
  div :global(pre.shiki) {
    margin: 0;
    background: transparent !important;
    white-space: pre;
  }

  div :global(code) {
    font-size: inherit;
    line-height: 1.5;
  }
</style>
