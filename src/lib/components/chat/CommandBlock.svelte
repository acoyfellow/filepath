<script lang="ts">
  interface Props {
    cmd: string;
    status: "start" | "done" | "error";
    exit?: number;
    stdout?: string;
    stderr?: string;
  }

  let { cmd, status, exit, stdout, stderr }: Props = $props();
  let open = $state(false);
  let hasOutput = $derived(!!(stdout || stderr));
</script>

<div class="cb">
  <button
    class="cb-header"
    onclick={() => { if (hasOutput) open = !open; }}
    style:cursor={hasOutput ? "pointer" : "default"}
  >
    {#if status === "done" && (exit === 0 || exit === undefined)}
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="var(--t4)" stroke-width="1.3" stroke-linecap="round">
        <path d="M4 6l2 2 4-4" />
      </svg>
    {:else if status === "error" || (exit !== undefined && exit !== 0)}
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#ef4444" stroke-width="1.3" stroke-linecap="round">
        <path d="M3 3l6 6M9 3l-6 6" />
      </svg>
    {:else}
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="var(--t5)" stroke-width="1.3" stroke-linecap="round">
        <path d="M3 6h6" />
      </svg>
    {/if}
    <span class="cb-cmd">{cmd}</span>
    {#if exit !== undefined}
      <span class="cb-exit" class:cb-exit-err={exit !== 0}>exit {exit}</span>
    {/if}
    {#if hasOutput}
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
  {#if open}
    {#if stdout}
      <pre class="cb-output">{stdout}</pre>
    {/if}
    {#if stderr}
      <pre class="cb-output cb-stderr">{stderr}</pre>
    {/if}
  {/if}
</div>

<style>
  .cb {
    background: var(--block-bg);
    border: 1px solid var(--block-b);
    border-radius: 7px;
    overflow: hidden;
    margin: 6px 0;
  }
  .cb-header {
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
  .cb-cmd {
    font-family: var(--m);
    font-size: 11px;
    color: var(--t3);
    font-weight: 500;
  }
  .cb-exit {
    font-family: var(--m);
    font-size: 9px;
    color: var(--t5);
    margin-left: auto;
  }
  .cb-exit-err {
    color: #ef4444;
  }
  .cb-output {
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
  .cb-stderr {
    color: #ef4444;
  }
</style>
