<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import { goto } from "$app/navigation";
  import Button from "$lib/components/ui/button/button.svelte";
  import SEO from "$lib/components/SEO.svelte";

  let name = $state("");
  let gitRepoUrl = $state("");
  let isCreating = $state(false);
  let errorMsg = $state<string | null>(null);

  async function create() {
    isCreating = true;
    errorMsg = null;
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          gitRepoUrl: gitRepoUrl.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create workspace");
      const data = (await res.json()) as { id: string };
      goto(`/workspace/${data.id}`);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : "Failed to create workspace";
      isCreating = false;
    }
  }
</script>

<SEO
  title="Create workspace | filepath"
  description="Create a new sandboxed git workspace for bounded background agents in filepath."
  keywords="create workspace, filepath"
  path="/workspace/new"
  type="website"
  section="Workspaces"
  tags="workspace,create"
  noindex
  breadcrumbs={[
    { name: "Dashboard", item: "/dashboard" },
    { name: "Create workspace", item: "/workspace/new" },
  ]}
/>

<div class="flex min-h-screen items-center justify-center bg-(--bg2) px-4 py-10 font-(family-name:--f) text-(--t2)">
  <div class="w-full max-w-md">
    <Button
      variant="ghost"
      class="mb-6 gap-2 px-0 text-[13px] text-(--t4) shadow-none hover:bg-transparent hover:text-(--t2)"
      onclick={() => goto("/dashboard")}
      aria-label="Back to dashboard"
      title="Back to dashboard"
    >
      <ArrowLeftIcon size={15} />
      <span>Workspaces</span>
    </Button>
    <h1 class="text-[28px] font-[650] tracking-[-0.03em] text-(--t1)">New workspace</h1>
    <p class="mb-8 mt-1 text-sm leading-7 text-(--t4)">
      Create a sandboxed git workspace for bounded background agents
    </p>

    <label class="mb-4 block text-xs font-medium uppercase tracking-[0.14em] text-(--t5)">
      Workspace name
      <input type="text" class="mt-2 block w-full rounded-xl border border-(--b1) bg-(--bg) px-4 py-3 text-sm normal-case tracking-normal text-(--t1) outline-none focus:border-(--accent)" placeholder="my-project" bind:value={name} onkeydown={(e) => { if (e.key === "Enter") create(); }} />
    </label>

    <label class="mb-4 block text-xs font-medium uppercase tracking-[0.14em] text-(--t5)">
      Git repo URL <span class="text-(--t6)">(optional)</span>
      <input type="text" class="mt-2 block w-full rounded-xl border border-(--b1) bg-(--bg) px-4 py-3 text-sm normal-case tracking-normal text-(--t1) outline-none focus:border-(--accent)" placeholder="https://github.com/user/repo" bind:value={gitRepoUrl} onkeydown={(e) => { if (e.key === "Enter") create(); }} />
    </label>

    {#if errorMsg}
      <div class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs normal-case tracking-normal text-red-700 dark:text-red-300">
        {errorMsg}
      </div>
    {/if}

    <Button class="h-11 w-full rounded-xl bg-(--accent) text-white shadow-none hover:opacity-90" disabled={isCreating} onclick={create}>
      {isCreating ? "Creating..." : "Create workspace"}
    </Button>
  </div>
</div>
