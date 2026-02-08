<script lang="ts">
  import { goto } from "$app/navigation";

  let name = $state("");
  let gitRepoUrl = $state("");
  let isCreating = $state(false);
  let errorMsg = $state<string | null>(null);

  async function create() {
    isCreating = true;
    errorMsg = null;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          gitRepoUrl: gitRepoUrl.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data = (await res.json()) as { id: string };
      goto(`/session/${data.id}?spawn=1`);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : "Failed to create session";
      isCreating = false;
    }
  }
</script>

<svelte:head>
  <title>New Session - filepath</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet" />
</svelte:head>

<div class="page">
  <div class="container">
    <button class="back-btn" onclick={() => goto("/dashboard")}>&larr; Dashboard</button>
    <h1 class="title">New session</h1>
    <p class="subtitle">Create an orchestration environment for your agents</p>

    <label class="field">
      Session name
      <input type="text" class="input" placeholder="my-project" bind:value={name} onkeydown={(e) => { if (e.key === "Enter") create(); }} />
    </label>

    <label class="field">
      Git repo URL <span class="optional">(optional)</span>
      <input type="text" class="input" placeholder="https://github.com/user/repo" bind:value={gitRepoUrl} onkeydown={(e) => { if (e.key === "Enter") create(); }} />
    </label>

    {#if errorMsg}
      <div class="error">{errorMsg}</div>
    {/if}

    <button class="btn-primary" disabled={isCreating} onclick={create}>
      {isCreating ? "Creating..." : "Create session"}
    </button>
  </div>
</div>

<style>
  .page {
    --bg: #09090b; --bg3: #111114; --b1: #1a1a1e;
    --t1: #e4e4e7; --t2: #a1a1aa; --t3: #71717a; --t4: #52525b;
    --accent: #818cf8;
    --mono: "JetBrains Mono", monospace; --sans: "Outfit", sans-serif;
    min-height: 100vh; background: var(--bg); color: var(--t2); font-family: var(--mono);
    display: flex; align-items: center; justify-content: center;
  }
  .container { width: 400px; max-width: 90vw; }
  .back-btn { font-size: 12px; font-family: var(--mono); color: var(--t3); background: none; border: none; cursor: pointer; margin-bottom: 24px; padding: 0; }
  .back-btn:hover { color: var(--t2); }
  .title { font-family: var(--sans); font-size: 18px; font-weight: 600; color: var(--t1); margin: 0 0 4px; }
  .subtitle { font-size: 12px; color: var(--t3); margin: 0 0 32px; }
  .field { display: block; font-size: 11px; color: var(--t3); margin-bottom: 16px; }
  .optional { color: var(--t4); }
  .input { display: block; width: 100%; margin-top: 6px; padding: 10px 12px; font-size: 13px; font-family: var(--mono); background: var(--bg3); color: var(--t1); border: 1px solid var(--b1); border-radius: 6px; outline: none; box-sizing: border-box; }
  .input:focus { border-color: var(--accent); }
  .error { padding: 10px; font-size: 12px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; color: #f87171; margin-bottom: 16px; }
  .btn-primary { width: 100%; padding: 10px; font-size: 13px; font-family: var(--mono); background: var(--accent); color: #fff; border: none; border-radius: 6px; cursor: pointer; }
  .btn-primary:hover { filter: brightness(1.1); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
