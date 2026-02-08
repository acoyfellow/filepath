<script lang="ts">
  interface Props {
    name: string;
    path?: string;
    output?: string;
  }

  let { name, path, output }: Props = $props();
  let open = $state(false);
</script>

<div class="tb">
  <button
    class="tb-header"
    onclick={() => { if (output) open = !open; }}
    style:cursor={output ? "pointer" : "default"}
  >
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="var(--t4)" stroke-width="1.3" stroke-linecap="round">
      <path d="M4 6l2 2 4-4" />
    </svg>
    <span class="tb-name">{name}</span>
    {#if path}
      <span class="tb-path">{path}</span>
    {/if}
    {#if output}
      <svg
        width="9" height="9" viewBox="0 0 12 12"
        style:margin-left="auto"
        style:transform={open ? "rotate(180deg)" : ""}
        style:transition="transform .1s"
      >
        <path d="M3 5l3 3 3-3" fill="none" stroke="var(--t4)" stroke-width="1.2" stroke-linecap="round" />
      </svg>
    {/if}
  </button>
  {#if open && output}
    <pre class="tb-output">{output}</pre>
  {/if}
</div>

<style>
  .tb {
    background: var(--block-bg);
    border: 1px solid var(--block-b);
    border-radius: 7px;
    overflow: hidden;
    margin: 6px 0;
  }
  .tb-header {
    padding: 6px 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    text-align: left;
  }
  .tb-name {
    font-family: var(--m);
    font-size: 11px;
    color: var(--t3);
    font-weight: 500;
  }
  .tb-path {
    font-family: var(--m);
    font-size: 10px;
    color: var(--t4);
    margin-left: auto;
  }
  .tb-output {
    padding: 8px 10px;
    margin: 0;
    font-family: var(--m);
    font-size: 11px;
    color: var(--t3);
    line-height: 1.6;
    white-space: pre-wrap;
    border-top: 1px solid var(--b1);
    background: var(--block-bg2);
  }
</style>
