<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import AgentSettingsForm from "$lib/components/workspace/AgentSettingsForm.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import type { AgentCreateRequest, HarnessId } from "$lib/types/workspace";
  import type { ProviderId } from "$lib/provider-keys";

  interface Props {
    onclose: () => void;
    onspawn: (req: AgentCreateRequest) => Promise<void> | void;
    onkeyschange?: (payload: {
      keys: Record<ProviderId, string | null>;
      error: string | null;
    }) => void;
    lastAgent?: HarnessId;
    lastModel?: string | undefined;
    accountKeysMasked?: Record<ProviderId, string | null>;
    accountKeysError?: string | null;
  }

  let {
    onclose,
    onspawn,
    onkeyschange = () => {},
    lastAgent = "shelley",
    lastModel = undefined,
    accountKeysMasked = { openrouter: null, zen: null },
    accountKeysError = null,
  }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 px-3 max-[720px]:items-start max-[720px]:p-2" onclick={(event) => event.target === event.currentTarget && onclose()}>
  <div
    class="max-h-[calc(100vh-24px)] w-full max-w-[760px] overflow-auto rounded-2xl border border-(--b1) bg-(--bg) shadow-(--shadow) max-[720px]:max-h-[calc(100vh-16px)] max-[720px]:rounded-[14px]"
    role="dialog"
    aria-modal="true"
    aria-labelledby="create-agent-title"
    tabindex="-1"
    onclick={(event) => event.stopPropagation()}
    onkeydown={(event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onclose();
      }
    }}
  >
    <header class="flex items-center justify-between gap-3 px-6 pb-0 pt-5 max-[720px]:px-4 max-[720px]:pt-4">
      <div class="text-xl font-[650] tracking-[-0.02em] text-(--t1) max-[720px]:text-lg" id="create-agent-title">new agent</div>
      <Button variant="outline" size="icon-sm" class="size-8 rounded-full border-(--b1) bg-(--bg2) text-(--t3) shadow-none hover:border-(--t4) hover:bg-(--bg3) hover:text-(--t1)" type="button" onclick={onclose} aria-label="Close create agent modal" title="Close create agent modal">
        <XIcon size={15} />
      </Button>
    </header>
    <div class="px-6 pb-6 pt-[18px] max-[720px]:px-4 max-[720px]:pb-[18px] max-[720px]:pt-3.5">
      <AgentSettingsForm
        mode="create"
        showNameField={true}
        submitLabel="create agent"
        submitBusyLabel="creating..."
        onsubmit={(payload) =>
          onspawn({
            name: payload.name ?? "",
            harnessId: payload.harnessId,
            model: payload.model,
            allowedPaths: payload.allowedPaths,
            forbiddenPaths: payload.forbiddenPaths,
            toolPermissions: payload.toolPermissions,
            writableRoot: payload.writableRoot,
          })}
        oncancel={onclose}
        {onkeyschange}
        initialHarnessId={lastAgent}
        initialModel={lastModel}
        {accountKeysMasked}
        accountKeysError={accountKeysError}
      />
    </div>
  </div>
</div>
