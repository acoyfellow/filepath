<script lang="ts">
  import type { AgentType, SpawnRequest } from "$lib/types/session";

  interface Props {
    onclose: () => void;
    onspawn: (req: SpawnRequest) => void;
    lastAgent?: AgentType;
    lastModel?: string;
  }

  let { onclose, onspawn, lastAgent = "shelley", lastModel = "claude-sonnet-4" }: Props = $props();

  const NAMES = ["atlas","bolt","cipher","drift","echo","flux","ghost","helix","iris","kite","nova","orbit","pulse","relay","spark","trace","vortex","wave","zero"];
  const AGENTS: { id: AgentType; label: string }[] = [
    { id: "shelley", label: "Shelley" },
    { id: "pi", label: "Pi" },
    { id: "claude-code", label: "Claude Code" },
    { id: "codex", label: "Codex" },
    { id: "cursor", label: "Cursor" },
    { id: "amp", label: "Amp" },
    { id: "custom", label: "Custom" },
  ];
  // Default model list -- will be replaced by dynamic OpenRouter fetch
  const MODELS = ["claude-sonnet-4", "claude-opus-4-6", "gpt-4o", "o3", "deepseek-r1", "gemini-2.5-pro"];

  function pickName(): string {
    const word = NAMES[Math.floor(Math.random() * NAMES.length)];
    const num = Math.floor(Math.random() * 99);
    return `${word}-${num}`;
  }

  let name = $state(pickName());
  let agent = $state<AgentType>(lastAgent);
  let model = $state(lastModel);
  let modelFilter = $state("");

  let filteredModels = $derived(
    modelFilter
      ? MODELS.filter(m => m.toLowerCase().includes(modelFilter.toLowerCase()))
      : MODELS
  );

  function handleSpawn() {
    if (!name.trim()) return;
    onspawn({ name: name.trim(), agentType: agent, model });
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onclose();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-bg" onclick={handleBackdrop}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-title">spawn agent</div>
    <div class="modal-body">
      <label class="modal-label">name</label>
      <div class="modal-name-row">
        <input bind:value={name} class="modal-input" />
        <button class="modal-dice" onclick={() => { name = pickName(); }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
            <path d="M1 6a5 5 0 018-4M11 6a5 5 0 01-8 4" />
            <path d="M9 1v2h2M3 11V9H1" />
          </svg>
        </button>
      </div>

      <label class="modal-label">agent</label>
      <div class="modal-options">
        {#each AGENTS as a}
          <button class="modal-option" class:on={agent === a.id} onclick={() => { agent = a.id; }}>
            {a.label}
          </button>
        {/each}
      </div>

      <label class="modal-label">model</label>
      <input
        class="modal-input modal-model-filter"
        placeholder="Search models..."
        bind:value={modelFilter}
        onfocus={() => { modelFilter = ""; }}
      />
      <div class="modal-options">
        {#each filteredModels as m}
          <button class="modal-option" class:on={model === m} onclick={() => { model = m; modelFilter = ""; }}>
            {m}
          </button>
        {/each}
      </div>
    </div>
    <div class="modal-footer">
      <button class="modal-cancel" onclick={onclose}>cancel</button>
      <button class="modal-go" onclick={handleSpawn}>spawn</button>
    </div>
  </div>
</div>

<style>
  .modal-bg {
    position: fixed;
    inset: 0;
    background: var(--overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(2px);
  }
  .modal {
    width: 340px;
    background: var(--modal-bg);
    border: 1px solid var(--b2);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: var(--shadow);
  }
  .modal-title {
    padding: 14px 18px 8px;
    font-family: var(--m);
    font-size: 13px;
    font-weight: 600;
    color: var(--t1);
  }
  .modal-body {
    padding: 0 18px 14px;
  }
  .modal-label {
    display: block;
    font-family: var(--m);
    font-size: 9px;
    color: var(--t4);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 10px 0 4px;
  }
  .modal-label:first-child {
    margin-top: 0;
  }
  .modal-name-row {
    display: flex;
    gap: 6px;
  }
  .modal-input {
    flex: 1;
    background: var(--bg3);
    border: 1px solid var(--b2);
    border-radius: 7px;
    padding: 8px 12px;
    color: var(--t1);
    font-family: var(--m);
    font-size: 12px;
    outline: none;
  }
  .modal-input:focus {
    border-color: var(--t5);
  }
  .modal-input::placeholder {
    color: var(--t5);
  }
  .modal-model-filter {
    margin-bottom: 6px;
  }
  .modal-dice {
    background: var(--bg3);
    border: 1px solid var(--b2);
    border-radius: 7px;
    padding: 0 10px;
    color: var(--t4);
    cursor: pointer;
    display: flex;
    align-items: center;
  }
  .modal-dice:hover {
    border-color: var(--t5);
  }
  .modal-options {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .modal-option {
    padding: 6px 11px;
    background: var(--bg3);
    border: 1px solid var(--b2);
    border-radius: 6px;
    cursor: pointer;
    font-family: var(--m);
    font-size: 11px;
    color: var(--t4);
    transition: all 0.1s;
  }
  .modal-option:hover {
    border-color: var(--t5);
    color: var(--t3);
  }
  .modal-option.on {
    background: color-mix(in srgb, var(--accent) 10%, var(--bg));
    border-color: color-mix(in srgb, var(--accent) 25%, transparent);
    color: var(--t1);
  }
  .modal-footer {
    padding: 10px 18px 14px;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    border-top: 1px solid var(--b1);
  }
  .modal-cancel {
    background: none;
    border: 1px solid var(--b2);
    color: var(--t4);
    padding: 6px 14px;
    border-radius: 7px;
    font-family: var(--m);
    font-size: 11px;
    cursor: pointer;
  }
  .modal-go {
    background: var(--accent);
    border: none;
    color: #fff;
    padding: 6px 18px;
    border-radius: 7px;
    font-family: var(--m);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
