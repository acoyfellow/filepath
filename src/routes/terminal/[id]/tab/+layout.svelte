<script lang="ts">
  import "../../../../app.css";
  let { children } = $props();
</script>

<div class="h-screen w-screen overflow-hidden bg-black">
  {@render children()}
</div>

