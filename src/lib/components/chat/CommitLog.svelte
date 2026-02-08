<script lang="ts">
  interface Commit {
    hash: string;
    message: string;
  }

  interface Props {
    commits: Commit[];
  }

  let { commits }: Props = $props();
</script>

<div class="cl">
  <div class="cl-header">
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="var(--t4)" stroke-width="1.3">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v4M8 11v4" stroke-linecap="round" />
    </svg>
    {commits.length} commit{commits.length !== 1 ? "s" : ""}
  </div>
  {#each commits as c}
    <div class="cl-row">
      <span class="cl-hash">{c.hash}</span>
      <span class="cl-msg">{c.message}</span>
    </div>
  {/each}
</div>

<style>
  .cl {
    background: var(--bg3);
    border: 1px solid var(--b1);
    border-radius: 7px;
    overflow: hidden;
    margin: 6px 0;
  }
  .cl-header {
    padding: 5px 10px;
    border-bottom: 1px solid var(--b1);
    font-family: var(--m);
    font-size: 10px;
    color: var(--t4);
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .cl-row {
    padding: 4px 10px;
    display: flex;
    gap: 8px;
  }
  .cl-row + .cl-row {
    border-top: 1px solid var(--b1);
  }
  .cl-hash {
    font-family: var(--m);
    font-size: 11px;
    color: var(--accent);
    flex-shrink: 0;
  }
  .cl-msg {
    font-family: var(--m);
    font-size: 11px;
    color: var(--t3);
  }
</style>
