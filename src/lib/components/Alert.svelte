<script lang="ts">
  import { X } from "@lucide/svelte";
  import { fly } from "svelte/transition";

  type ToastType = "error" | "confirm" | "success" | "notification";

  interface Toast {
    _id: number;
    msg: string;
    type: ToastType;
  }

  let toasts: Toast[] = $state([]);
  let toastId = 0;
  let callback: (() => void) | null = null;

  const toastClasses = {
    error: "bg-red-900/90 text-red-100 border-red-700",
    confirm: "bg-blue-900/90 text-blue-100 border-blue-700",
    success: "bg-green-900/90 text-green-100 border-green-700",
    notification: "bg-neutral-800/90 text-neutral-100 border-neutral-700",
  };

  export const alert = (
    msg = "",
    type: ToastType = "notification",
    autoHide = true,
    onClose: (() => void) | false = false,
    retainMs = type === "error" ? 8500 : 3500
  ) => {
    const _id = ++toastId;
    toasts = [...toasts, { _id, msg, type }];
    if (autoHide) setTimeout(() => removeToast(_id), retainMs);
    if (onClose) callback = onClose;
  };

  const removeToast = (_id: number) => {
    toasts = toasts.filter((a) => a._id !== _id);
    if (callback) {
      callback();
      callback = null;
    }
  };

  // Expose to window for global access
  if (typeof window !== "undefined") {
    window.alert = alert;
  }
</script>

<!-- Toast Container -->
<div class="fixed bottom-4 right-4 z-[2147483647] space-y-2">
  {#each toasts as toast (toast._id)}
    <div
      in:fly={{ y: -10, duration: 100 }}
      out:fly={{ y: 10, duration: 100 }}
      class="min-w-64 flex items-center gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl {toastClasses[
        toast.type
      ]}"
    >
      <span class="flex-1">{toast.msg}</span>
      <div class="relative">
        <button
          onclick={() => removeToast(toast._id)}
          class="text-current hover:opacity-70 transition-opacity p-2 after:content-[''] after:absolute after:inset-0 cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>
    </div>
  {/each}
</div>
