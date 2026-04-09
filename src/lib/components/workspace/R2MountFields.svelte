<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";

  type EditableR2Mount = {
    bucket: string;
    mountPath: string;
    readonly: boolean;
    prefix: string;
  };

  interface Props {
    mounts?: EditableR2Mount[];
    disabled?: boolean;
  }

  let { mounts = $bindable([]), disabled = false }: Props = $props();

  function addMount() {
    mounts = [
      ...mounts,
      {
        bucket: "",
        mountPath: "/data",
        readonly: true,
        prefix: "",
      },
    ];
  }

  function updateMount(index: number, next: EditableR2Mount) {
    mounts = mounts.map((mount, mountIndex) => (mountIndex === index ? next : mount));
  }

  function removeMount(index: number) {
    mounts = mounts.filter((_, mountIndex) => mountIndex !== index);
  }
</script>

<div class="mt-6 space-y-3">
  <div class="flex items-center justify-between gap-3">
    <div>
      <div class="text-sm font-medium text-(--t1)">R2 mounts</div>
      <p class="mt-1 text-xs leading-5 text-(--t4)">
        Optional persistent storage mounted at absolute paths like /data or /mnt/r2.
      </p>
    </div>
    <Button type="button" variant="outline" class="shrink-0" disabled={disabled} onclick={addMount}>
      Add mount
    </Button>
  </div>

  {#if mounts.length === 0}
    <div class="rounded-xl border border-dashed border-(--b1) bg-(--bg2) px-4 py-3 text-sm text-(--t4)">
      No R2 buckets mounted for this workspace.
    </div>
  {:else}
    {#each mounts as mount, index (index)}
      <div class="space-y-3 rounded-xl border border-(--b1) bg-(--bg2) p-4">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="block text-xs font-medium uppercase tracking-[0.14em] text-(--t5)">
            Bucket
            <input
              type="text"
              class="mt-2 block w-full rounded-xl border border-(--b1) bg-(--bg) px-4 py-3 text-sm normal-case tracking-normal text-(--t1) outline-none focus:border-(--accent)"
              placeholder="my-models-bucket"
              value={mount.bucket}
              disabled={disabled}
              oninput={(event) =>
                updateMount(index, {
                  ...mount,
                  bucket: (event.currentTarget as HTMLInputElement).value,
                })}
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-[0.14em] text-(--t5)">
            Mount path
            <input
              type="text"
              class="mt-2 block w-full rounded-xl border border-(--b1) bg-(--bg) px-4 py-3 text-sm normal-case tracking-normal text-(--t1) outline-none focus:border-(--accent)"
              placeholder="/data"
              value={mount.mountPath}
              disabled={disabled}
              oninput={(event) =>
                updateMount(index, {
                  ...mount,
                  mountPath: (event.currentTarget as HTMLInputElement).value,
                })}
            />
          </label>

          <label class="block text-xs font-medium uppercase tracking-[0.14em] text-(--t5)">
            Prefix (optional)
            <input
              type="text"
              class="mt-2 block w-full rounded-xl border border-(--b1) bg-(--bg) px-4 py-3 text-sm normal-case tracking-normal text-(--t1) outline-none focus:border-(--accent)"
              placeholder="/models"
              value={mount.prefix}
              disabled={disabled}
              oninput={(event) =>
                updateMount(index, {
                  ...mount,
                  prefix: (event.currentTarget as HTMLInputElement).value,
                })}
            />
          </label>

          <label class="flex items-center gap-3 rounded-xl border border-(--b1) bg-(--bg) px-4 py-3 text-sm text-(--t2)">
            <input
              type="checkbox"
              checked={mount.readonly}
              disabled={disabled}
              onchange={(event) =>
                updateMount(index, {
                  ...mount,
                  readonly: (event.currentTarget as HTMLInputElement).checked,
                })}
            />
            <span>Read-only mount</span>
          </label>
        </div>

        <div class="flex justify-end">
          <Button type="button" variant="ghost" class="text-(--t4)" disabled={disabled} onclick={() => removeMount(index)}>
            Remove
          </Button>
        </div>
      </div>
    {/each}
  {/if}
</div>
