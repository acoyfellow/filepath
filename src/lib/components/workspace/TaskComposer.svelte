<script lang="ts">
  import SendIcon from "@lucide/svelte/icons/send";
  import Button from "$lib/components/ui/button/button.svelte";
  interface Props {
    onsend: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
    actionLabel?: string;
  }

  let {
    onsend,
    disabled = false,
    placeholder = "Describe the task...",
    actionLabel = "Run task",
  }: Props = $props();

  let value = $state("");

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onsend(trimmed);
    value = "";
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }
</script>

<div class="flex gap-2 border-t border-[var(--b1)] px-4 py-2.5 max-[640px]:gap-2.5 max-[640px]:px-3 max-[640px]:pb-3">
  <input
    class="min-h-[42px] flex-1 rounded-xl border border-[var(--b2)] bg-[var(--bg2)] px-3.5 py-2.5 font-[var(--f)] text-sm text-[var(--t1)] outline-none transition placeholder:text-[var(--t5)] focus:border-[var(--accent)]"
    {placeholder}
    bind:value
    onkeydown={handleKeydown}
    {disabled}
  />
  <Button
    variant="default"
    size="icon"
    class="size-[38px] shrink-0 rounded-xl bg-[var(--accent)] text-white hover:opacity-85 max-[640px]:size-[42px]"
    onclick={handleSubmit}
    disabled={disabled || !value.trim()}
    aria-label={actionLabel}
    title={actionLabel}
  >
    <SendIcon size={15} />
  </Button>
</div>
