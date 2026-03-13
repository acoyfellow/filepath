<script lang="ts">
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

<div class="task-composer">
  <input
    class="task-composer-input"
    {placeholder}
    bind:value
    onkeydown={handleKeydown}
    {disabled}
  />
  <button
    class="task-composer-submit"
    onclick={handleSubmit}
    disabled={disabled || !value.trim()}
    aria-label={actionLabel}
  >
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2L7 9M14 2l-4 12-3-5-5-3z" />
    </svg>
  </button>
</div>

<style>
  .task-composer {
    display: flex;
    gap: 8px;
    border-top: 1px solid var(--b1);
    padding: 10px 16px;
  }

  .task-composer-input {
    flex: 1;
    border: 1px solid var(--b2);
    border-radius: 10px;
    background: var(--bg2);
    padding: 10px 14px;
    font-family: var(--m);
    font-size: 13px;
    color: var(--t1);
    outline: none;
    transition: border 0.1s;
  }

  .task-composer-input:focus {
    border-color: var(--t5);
  }

  .task-composer-input::placeholder {
    color: var(--t5);
  }

  .task-composer-submit {
    display: flex;
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 10px;
    background: var(--accent);
    color: #fff;
    cursor: pointer;
    transition: opacity 0.1s;
  }

  .task-composer-submit:hover:not(:disabled) {
    opacity: 0.85;
  }

  .task-composer-submit:disabled {
    opacity: 0.4;
    cursor: default;
  }

  @media (max-width: 640px) {
    .task-composer {
      padding: 10px 12px 12px;
      gap: 10px;
    }

    .task-composer-input {
      min-height: 42px;
      padding: 10px 12px;
      font-size: 14px;
    }

    .task-composer-submit {
      width: 42px;
      height: 42px;
    }
  }
</style>
