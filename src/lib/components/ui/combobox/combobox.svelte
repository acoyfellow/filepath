<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { cn } from "$lib/utils.js";

  export type ComboboxOption = {
    value: string;
    label: string;
    description?: string;
  };

  interface Props {
    /** Single-select value (ignored when `multi` is true). */
    value?: string;
    /** Multi-select values (used when `multi` is true). */
    values?: string[];
    multi?: boolean;
    options: ComboboxOption[];
    searchValue: string;
    placeholder?: string;
    disabled?: boolean;
    emptyText?: string;
    clearSearchOnSelect?: boolean;
    inputClass?: string;
    optionClass?: string;
    listClass?: string;
    onSearchValueChange: (value: string) => void;
    onValueChange?: (value: string) => void;
    onValuesChange?: (values: string[]) => void;
  }

  let {
    value = "",
    values = [],
    multi = false,
    options,
    searchValue,
    placeholder = "Choose an option",
    disabled = false,
    emptyText = "No matches",
    clearSearchOnSelect = true,
    inputClass,
    optionClass,
    listClass,
    onSearchValueChange,
    onValueChange = () => {},
    onValuesChange = () => {},
  }: Props = $props();

  let open = $state(false);

  let selectedLabel = $derived.by(() => {
    if (multi) {
      const vals = values ?? [];
      if (vals.length === 0) return "";
      const labels = vals
        .map((v) => options.find((o) => o.value === v)?.label ?? v)
        .filter(Boolean);
      if (labels.length <= 3) return labels.join(", ");
      return `${labels.length} selected`;
    }
    const opt = options.find((o) => o.value === value);
    return opt?.label ?? value ?? "";
  });

  /** Show selection when closed + not typing; while open with empty search show blank for filtering. */
  let inputDisplay = $derived(searchValue !== "" ? searchValue : !open ? selectedLabel : "");
  let activeIndex = $state(0);
  let wrapperEl = $state<HTMLDivElement | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);
  let listStyle = $state("");

  /** Append list to body so overflow/clipping in drawers/modals does not eat pointer events. */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function layoutList() {
    if (!open || disabled || !inputEl) {
      listStyle = "";
      return;
    }
    const r = inputEl.getBoundingClientRect();
    const gap = 8;
    const maxH = Math.min(240, window.innerHeight - r.bottom - gap - 8);
    listStyle = [
      "position:fixed",
      `left:${r.left}px`,
      `top:${r.bottom + gap}px`,
      `width:${r.width}px`,
      `max-height:${Math.max(120, maxH)}px`,
      "z-index:2147483646",
    ].join(";");
  }

  async function syncLayout() {
    await tick();
    layoutList();
    requestAnimationFrame(() => layoutList());
  }

  function openIfEnabled() {
    if (disabled) return;
    open = true;
    activeIndex = 0;
    void syncLayout();
  }

  function close() {
    open = false;
    listStyle = "";
  }

  function handleDocumentPointerDown(event: PointerEvent) {
    const path = event.composedPath();
    for (const node of path) {
      if (node === wrapperEl) return;
      if (node === listEl) return;
      if (node instanceof HTMLElement && node.dataset.fpComboboxList === "1") return;
    }
    close();
  }

  onMount(() => {
    window.addEventListener("pointerdown", handleDocumentPointerDown, { capture: true });
    window.addEventListener("resize", layoutList);
    window.addEventListener("scroll", layoutList, true);
    return () => {
      window.removeEventListener("pointerdown", handleDocumentPointerDown, { capture: true } as never);
      window.removeEventListener("resize", layoutList);
      window.removeEventListener("scroll", layoutList, true);
    };
  });

  onDestroy(() => {
    close();
  });

  function optionSelected(optValue: string): boolean {
    if (multi) return (values ?? []).includes(optValue);
    return optValue === value;
  }

  function selectOptionByIndex(index: number) {
    const opt = options[index];
    if (!opt) return;

    if (multi) {
      const curr = [...(values ?? [])];
      const pos = curr.indexOf(opt.value);
      if (pos >= 0) {
        curr.splice(pos, 1);
      } else {
        curr.push(opt.value);
      }
      const order = new Map(options.map((o, idx) => [o.value, idx]));
      curr.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
      onValuesChange(curr);
      void syncLayout();
      return;
    }

    onValueChange(opt.value);
    if (clearSearchOnSelect) onSearchValueChange("");
    close();
  }

  function onInputKeyDown(event: KeyboardEvent) {
    if (disabled) return;
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) openIfEnabled();
    if (!open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (options.length === 0) return;
      activeIndex = Math.min(options.length - 1, activeIndex + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length === 0) return;
      activeIndex = Math.max(0, activeIndex - 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (options.length === 0) return;
      selectOptionByIndex(Math.min(activeIndex, options.length - 1));
      return;
    }
  }

  function onInput(event: Event) {
    if (disabled) return;
    open = true;
    activeIndex = 0;
    onSearchValueChange((event.currentTarget as HTMLInputElement).value);
    void syncLayout();
  }
</script>

<div class="relative" bind:this={wrapperEl} data-fp-combobox-root>
  <input
    bind:this={inputEl}
    type="text"
    class={cn(
      "w-full rounded-xl border border-(--b1) bg-(--bg2) px-4 py-3 text-sm text-(--t1) outline-none transition placeholder:text-(--t5) focus:border-(--accent) focus:ring-0",
      !disabled ? "" : "opacity-60 cursor-not-allowed",
      inputClass
    )}
    value={inputDisplay}
    placeholder={placeholder}
    disabled={disabled}
    onfocus={() => openIfEnabled()}
    oninput={onInput}
    onkeydown={onInputKeyDown}
  />
</div>

{#if open && !disabled}
  <div
    use:portal
    bind:this={listEl}
    data-fp-combobox-list="1"
    class={cn(
      "overflow-auto rounded-xl border border-(--b1) bg-(--bg) text-(--t2) shadow-[0_10px_30px_rgba(0,0,0,0.12)] pointer-events-auto",
      listClass
    )}
    style={listStyle}
    role="listbox"
    aria-multiselectable={multi ? "true" : undefined}
  >
    {#if options.length === 0}
      <div class={cn("px-4 py-3 text-sm text-(--t5)")} aria-disabled="true">{emptyText}</div>
    {:else}
      {#each options as opt, idx (opt.value)}
        <button
          type="button"
          role="option"
          class={cn(
            "w-full px-4 py-3 text-left text-sm text-(--t2) transition hover:bg-(--bg3) hover:text-(--t1)",
            idx === activeIndex ? "bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg3))] border border-(--b2) rounded-xl" : "",
            optionSelected(opt.value) ? "text-(--t1) font-semibold" : "",
            optionClass
          )}
          onclick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            selectOptionByIndex(idx);
          }}
          aria-selected={optionSelected(opt.value)}
        >
          <div class="flex flex-col gap-0.5">
            <div class="truncate">{opt.label}</div>
            {#if opt.description}
              <div class="truncate text-xs text-(--t5)">{opt.description}</div>
            {/if}
          </div>
        </button>
      {/each}
    {/if}
  </div>
{/if}
