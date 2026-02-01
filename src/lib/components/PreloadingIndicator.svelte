<script>
  import { onMount } from "svelte";
  let p = 0;
  let visible = false;
  onMount(() => {
    visible = true;
    function next() {
      p += 0.1;
      const remaining = 1 - p;
      if (remaining > 0.15) setTimeout(next, 500 / remaining);
    }
    setTimeout(next, 250);
  });
</script>

{#if visible}
  <div class="fixed top-0 left-0 w-full h-1 z-[1000]">
    <div
      class="absolute left-0 top-0 h-full bg-neutral-100 transition-all duration-400"
      style="width: {p * 100}%"
    ></div>
  </div>
{/if}

{#if p >= 0.04}
  <div
    class="fixed inset-0 bg-neutral-950/50 pointer-events-none z-40 animate-fade"
  ></div>
{/if}

<style>
  @keyframes fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .animate-fade {
    animation: fade 0.4s;
  }
</style>
