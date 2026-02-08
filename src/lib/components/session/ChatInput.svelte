<script lang="ts">
  interface Props {
    onsend: (message: string) => void;
    disabled?: boolean;
  }

  let { onsend, disabled = false }: Props = $props();
  let value = $state("");

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onsend(trimmed);
    value = "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }
</script>

<div class="chat-bar">
  <input
    class="chat-input"
    placeholder="Message..."
    bind:value
    onkeydown={handleKeydown}
    {disabled}
  />
  <button class="chat-send" onclick={handleSend} disabled={disabled || !value.trim()}>
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2L7 9M14 2l-4 12-3-5-5-3z" />
    </svg>
  </button>
</div>

<style>
  .chat-bar {
    padding: 10px 16px;
    border-top: 1px solid var(--b1);
    display: flex;
    gap: 8px;
  }
  .chat-input {
    flex: 1;
    background: var(--bg2);
    border: 1px solid var(--b2);
    border-radius: 10px;
    padding: 10px 14px;
    color: var(--t1);
    font-family: var(--m);
    font-size: 13px;
    outline: none;
    transition: border 0.1s;
  }
  .chat-input:focus {
    border-color: var(--t5);
  }
  .chat-input::placeholder {
    color: var(--t5);
  }
  .chat-send {
    background: var(--accent);
    border: none;
    color: #fff;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: opacity 0.1s;
  }
  .chat-send:hover:not(:disabled) {
    opacity: 0.85;
  }
  .chat-send:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
