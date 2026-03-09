<script lang="ts">
  import { X } from "@lucide/svelte";
  import { fly } from "svelte/transition";
  import { removeToast, toastClasses, toasts } from "$lib/components/alert";
</script>

<!-- Toast Container -->
<div class="fixed bottom-4 right-4 z-[2147483647] space-y-2">
  {#each $toasts as toast (toast._id)}
    <div
      in:fly={{ y: -10, duration: 100 }}
      out:fly={{ y: 10, duration: 100 }}
      class="min-w-64 flex items-center gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl {toastClasses[
        toast.type
      ]}"
    >
      <span class="flex-1">{toast.msg}</span>
      {#if toast.type === "confirm"}
        <div class="flex items-center gap-2">
          <button
            onclick={() => removeToast(toast._id, false)}
            class="rounded-md border border-blue-300/30 px-3 py-1 text-xs font-medium text-current transition-opacity hover:opacity-80"
          >
            Cancel
          </button>
          <button
            onclick={() => removeToast(toast._id, true)}
            class="rounded-md bg-white/15 px-3 py-1 text-xs font-medium text-current transition-opacity hover:opacity-80"
          >
            Confirm
          </button>
        </div>
      {/if}
      <div class="relative">
        <button
          onclick={() => removeToast(toast._id, false)}
          class="text-current hover:opacity-70 transition-opacity p-2 after:content-[''] after:absolute after:inset-0 cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>
    </div>
  {/each}
</div>
