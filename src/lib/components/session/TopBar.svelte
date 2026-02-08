<script lang="ts">
  interface Props {
    dark: boolean;
    ontoggletheme: () => void;
  }

  let { dark, ontoggletheme }: Props = $props();
</script>

<div class="top">
  <div class="top-left">
    <div class="top-logo">
      <svg width="14" height="14" viewBox="0 0 339 339" fill="none">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M119.261 35C128.462 35.0001 137.256 38.8378 143.569 45.6083L160.108 63.3453C166.421 70.1159 175.215 73.9536 184.416 73.9536H298.583C317.039 73.9536 332 89.0902 332 107.762V270.191C332 288.863 317.039 304 298.583 304H41.417C22.9613 304 8 288.863 8 270.191V68.8087C8.0001 50.1368 22.9614 35 41.417 35H119.261ZM169.23 219.37V259.415H291.318V219.37H169.23ZM50.7361 111.182L110.398 171.838L51.027 226.311L79.9846 258.994L169.77 173.606L82.022 81.2961L50.7361 111.182Z" fill="currentColor" />
      </svg>
    </div>
    <span class="top-name">filepath</span>
  </div>
  <div class="top-right">
    <button class="top-theme" onclick={ontoggletheme} title={dark ? "Light mode" : "Dark mode"}>
      {#if dark}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <circle cx="8" cy="8" r="3.5" />
          <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" />
        </svg>
      {:else}
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <path d="M13.5 8.5a5.5 5.5 0 01-7-7 6 6 0 107 7z" />
        </svg>
      {/if}
    </button>
  </div>
</div>

<style>
  .top {
    height: 36px;
    border-bottom: 1px solid var(--b1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    background: var(--top-bg);
    flex-shrink: 0;
  }
  .top-left, .top-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .top-logo {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
  }
  .top-name {
    font-family: var(--m);
    font-size: 12px;
    font-weight: 600;
    color: var(--t1);
  }
  .top-theme {
    background: none;
    border: 1px solid var(--b1);
    border-radius: 5px;
    width: 28px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--t4);
    transition: border 0.1s;
  }
  .top-theme:hover {
    border-color: var(--t5);
  }
</style>
