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

<div class="flex shrink-0 gap-2 border-t border-(--b1) bg-(--bg2) px-4 py-2.5 max-[640px]:gap-2.5 max-[640px]:px-3 max-[640px]:pb-3">
  <input
    class="min-h-[42px] flex-1 rounded-xl border border-(--b2) bg-(--bg2) px-3.5 py-2.5 font-(family-name:--f) text-sm text-(--t1) outline-none transition placeholder:text-(--t5) focus:border-(--accent)"
    {placeholder}
    bind:value
    onkeydown={handleKeydown}
    {disabled}
  />
  <Button
    variant="accent"
    size="icon"
    class="size-[38px] shrink-0 max-[640px]:size-[42px]"
    onclick={handleSubmit}
    disabled={disabled || !value.trim()}
    aria-label={actionLabel}
    title={actionLabel}
  >
    <SendIcon size={15} />
  </Button>
</div>
