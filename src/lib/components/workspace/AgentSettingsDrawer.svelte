<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import AgentSettingsForm from "$lib/components/workspace/AgentSettingsForm.svelte";
  import Button from "$lib/components/ui/button/button.svelte";
  import type { AgentRecord, AgentUpdateRequest } from "$lib/types/workspace";
  import type { ProviderId } from "$lib/provider-keys";

  interface Props {
    agent: AgentRecord;
    open: boolean;
    onclose: () => void;
    onsave: (payload: AgentUpdateRequest) => Promise<void> | void;
    onkeyschange?: (payload: {
      keys: Record<ProviderId, string | null>;
      error: string | null;
    }) => void;
    accountKeysMasked?: Record<ProviderId, string | null>;
    accountKeysError?: string | null;
  }

  let {
    agent,
    open,
    onclose,
    onsave,
    onkeyschange = () => {},
    accountKeysMasked = { openrouter: null, zen: null },
    accountKeysError = null,
  }: Props = $props();

  let isBusy = $derived(agent.status === "running" || agent.status === "thinking");
  let topNotice = $derived(
    isBusy
      ? {
          tone: "warning" as const,
          title: "Applies to the next task",
          message: "You can save changes now. The current task keeps running with its existing config.",
        }
      : {
          tone: "info" as const,
          title: "Edit this agent",
          message: "Harness, model, and scope changes save immediately. The next task uses the updated config.",
        },
  );
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-[85] flex justify-end bg-black/25 max-[720px]:items-end max-[720px]:justify-stretch" onclick={(event) => event.target === event.currentTarget && onclose()}>
    <div
      class="flex h-dvh w-full max-w-[560px] flex-col border-l border-[var(--b1)] bg-[var(--bg)] shadow-[var(--shadow)] max-[720px]:h-[min(92dvh,780px)] max-[720px]:max-w-none max-[720px]:rounded-t-[18px] max-[720px]:border-l-0 max-[720px]:border-t"
      data-testid="agent-settings-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-settings-title"
      tabindex="-1"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onclose();
        }
      }}
    >
      <header class="flex items-start justify-between gap-3 border-b border-[var(--b1)] px-5 py-[18px] pb-3.5 max-[720px]:px-4 max-[720px]:py-3.5 max-[720px]:pb-3">
        <div>
          <div class="text-lg font-[650] tracking-[-0.02em] text-[var(--t1)] max-[720px]:text-base" id="agent-settings-title">Agent settings</div>
          <div class="mt-1 text-xs text-[var(--t5)]">{agent.name}</div>
        </div>
        <Button variant="outline" size="icon-sm" class="size-8 rounded-full border-[var(--b1)] bg-[var(--bg2)] text-[var(--t3)] shadow-none hover:border-[var(--t4)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]" type="button" onclick={onclose} aria-label="Close settings" title="Close settings">
          <XIcon size={15} />
        </Button>
      </header>

      <div class="flex-1 overflow-auto px-5 py-[18px] pb-6 max-[720px]:px-4 max-[720px]:py-3.5 max-[720px]:pb-5">
        <AgentSettingsForm
          mode="edit"
          submitLabel="save changes"
          submitBusyLabel="saving..."
          onsubmit={(payload) =>
            onsave({
              harnessId: payload.harnessId,
              model: payload.model,
              allowedPaths: payload.allowedPaths,
              forbiddenPaths: payload.forbiddenPaths,
              toolPermissions: payload.toolPermissions,
              writableRoot: payload.writableRoot,
            })}
          oncancel={onclose}
          {onkeyschange}
          initialHarnessId={agent.harnessId}
          initialModel={agent.model}
          initialAllowedPaths={agent.allowedPaths}
          initialForbiddenPaths={agent.forbiddenPaths}
          initialToolPermissions={agent.toolPermissions}
          initialWritableRoot={agent.writableRoot}
          {accountKeysMasked}
          accountKeysError={accountKeysError}
          {topNotice}
        />
      </div>
    </div>
  </div>
{/if}
