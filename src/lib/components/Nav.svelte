<script lang="ts">
  import { getContext, onMount } from "svelte";
  import { signOut } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import MenuIcon from "@lucide/svelte/icons/menu";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import MoreVerticalIcon from "@lucide/svelte/icons/more-vertical";
  import SunMediumIcon from "@lucide/svelte/icons/sun-medium";
  import UserRoundIcon from "@lucide/svelte/icons/user-round";
  import XIcon from "@lucide/svelte/icons/x";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { workspaceNewConversationHandler } from "$lib/workspace-nav";

  interface Props {
    current?: string | null;
    workspaceId?: string | null;
    isWorkspace?: boolean;
    showAuthedControls?: boolean;
  }

  let {
    current = null,
    workspaceId = null,
    isWorkspace = false,
    showAuthedControls = true,
  }: Props = $props();
  const { toggleTheme } = getContext<{ toggleTheme: () => void }>("theme");
  let mobileOpen = $state(false);
  let isDark = $state(false);

  async function signOutUser() {
    try {
      await signOut();
      goto("/");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  }

  function closeMobile() {
    mobileOpen = false;
  }

  function syncThemeState() {
    if (typeof document === "undefined") return;
    isDark = document.documentElement.classList.contains("dark");
  }

  onMount(() => {
    syncThemeState();
  });
  const iconButtonClass =
    "size-12 rounded border border-(--b1) bg-(--bg2)/90 text-(--t2) shadow-none hover:border-(--t4) hover:bg-(--bg3) hover:text-(--t1)";
  const ghostIconButtonClass =
    "size-8 rounded-full border border-transparent bg-transparent text-(--t2) shadow-none hover:bg-(--bg3) hover:text-(--t1)";

  const publicMobileLinks = [
    { href: "/api/openapi.json", label: "api", active: false },
    { href: "/dashboard", label: "dashboard", active: false },
  ];

  function getAuthedMobileLinks() {
    if (isWorkspace) {
      return [
        { href: "/dashboard", label: "workspaces", active: false },
        { href: "/settings/api-keys", label: "api keys", active: false },
        { href: "/settings/account", label: "account", active: false },
      ];
    }

    return [
      { href: "/dashboard", label: "workspaces", active: current === "dashboard" },
      { href: "/settings/api-keys", label: "api keys", active: current === "api-keys" },
      { href: "/settings/account", label: "account", active: current === "account" },
    ];
  }
</script>

{#snippet logoIcon(size: number)}
  <img
    src="/logo.svg"
    alt="filepath logo"
    width={size}
    height={size}
    class="shrink-0"
    loading="lazy"
  />
{/snippet}

{#snippet menuButton()}
  <Button
    onclick={() => (mobileOpen = !mobileOpen)}
    variant="ghost"
    size="icon-lg"
    class={`md:hidden -mr-1 ${ghostIconButtonClass}`}
    aria-label="Toggle menu"
    aria-expanded={mobileOpen}
    title="Toggle menu"
  >
    {#if mobileOpen}
      <XIcon size={18} />
    {:else}
      <MenuIcon size={18} />
    {/if}
  </Button>
{/snippet}

{#snippet mobileLink(href: string, label: string, active: boolean)}
  <a
    {href}
    onclick={closeMobile}
    class="block px-4 py-3 text-sm transition-colors {active
      ? 'text-gray-900 bg-gray-100 dark:text-neutral-100 dark:bg-neutral-800/50'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800/30'}"
  >
    {label}
  </a>
{/snippet}

{#snippet mobileLinks(links: Array<{ href: string; label: string; active: boolean }>)}
  {#each links as link (link.href)}
    {@render mobileLink(link.href, link.label, link.active)}
  {/each}
{/snippet}

{#snippet themeButton()}
  <Button
    type="button"
    variant="outline"
    size="icon-lg"
    class={iconButtonClass}
    onclick={() => {
      toggleTheme();
      syncThemeState();
    }}
    title="Toggle theme"
    aria-label="Toggle theme"
  >
    {#if isDark}
      <SunMediumIcon size={15} />
    {:else}
      <MoonIcon size={15} />
    {/if}
  </Button>
{/snippet}

  <nav
    class={`border-b border-gray-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm relative z-50 px-6 py-3 ${
      isWorkspace ? "sticky top-0 dark:bg-neutral-950/80" : ""
    }`}
  >
    <div class="mx-auto flex items-center justify-between">
      <div class="flex items-center gap-2 min-w-0">
        {#if isWorkspace}
          <Button
            href="/dashboard"
            variant="ghost"
            size="icon-lg"
            class={ghostIconButtonClass}
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowLeftIcon />
          </Button>
          <a
            href="/dashboard"
            class="flex items-center gap-2 shrink-0 text-gray-900 dark:text-neutral-100 hit-area-2"
            aria-label="Go to dashboard"
            title="Go to dashboard"
          >
            {@render logoIcon(24)}
          </a>
          {#if $workspaceNewConversationHandler}
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              class={ghostIconButtonClass}
              onclick={() => $workspaceNewConversationHandler?.()}
              aria-label="New conversation"
              title="New conversation"
              data-testid="open-create-agent"
            >
              <PlusIcon size={18} />
            </Button>
          {/if}
        {:else}
          {#if showAuthedControls}
            <a href="/dashboard" class="flex items-center gap-2 shrink-0 hit-area-2">
              {@render logoIcon(20)}
              <span class="font-medium text-sm text-gray-900 dark:text-neutral-100">filepath</span>
            </a>
          {:else}
            <a href="/" class="flex items-center gap-2 shrink-0 hit-area-2">
              {@render logoIcon(20)}
              <span class="font-medium text-sm text-gray-900 dark:text-neutral-100">filepath</span>
            </a>
          {/if}
        {/if}
      </div>

      {#if showAuthedControls}
        <div class="hidden md:block">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              class={`inline-flex ${iconButtonClass} cursor-pointer items-center justify-center`}
              aria-label="Account and app menu"
              title="Account and app menu"
            >
              <MoreVerticalIcon size={18} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              class="min-w-[12rem] rounded-xl border border-(--b1) bg-(--bg) p-1.5 text-(--t2) shadow-(--shadow)"
            >
              <DropdownMenu.Item
                class="cursor-pointer rounded-lg px-3 py-2 font-(family-name:--f) text-[13px] font-medium text-(--t2) [&_svg]:size-4 [&_svg]:text-(--t4) data-highlighted:bg-(--bg3) data-highlighted:text-(--t1) data-highlighted:[&_svg]:text-(--t2)"
                onclick={() => goto("/settings/api-keys")}
              >
                <KeyRoundIcon />
                API keys
              </DropdownMenu.Item>
              <DropdownMenu.Item
                class="cursor-pointer rounded-lg px-3 py-2 font-(family-name:--f) text-[13px] font-medium text-(--t2) [&_svg]:size-4 [&_svg]:text-(--t4) data-highlighted:bg-(--bg3) data-highlighted:text-(--t1) data-highlighted:[&_svg]:text-(--t2)"
                onclick={() => goto("/settings/account")}
              >
                <UserRoundIcon />
                Account
              </DropdownMenu.Item>
              <DropdownMenu.Separator class="my-1 bg-(--b1)" />
              <DropdownMenu.Item
                class="cursor-pointer rounded-lg px-3 py-2 font-(family-name:--f) text-[13px] font-medium text-(--t2) [&_svg]:size-4 [&_svg]:text-(--t4) data-highlighted:bg-(--bg3) data-highlighted:text-(--t1) data-highlighted:[&_svg]:text-(--t2)"
                onclick={() => {
                  toggleTheme();
                  syncThemeState();
                }}
              >
                {#if isDark}
                  <SunMediumIcon />
                  Light mode
                {:else}
                  <MoonIcon />
                  Dark mode
                {/if}
              </DropdownMenu.Item>
              <DropdownMenu.Separator class="my-1 bg-(--b1)" />
              <DropdownMenu.Item
                variant="destructive"
                class="cursor-pointer rounded-lg px-3 py-2 font-(family-name:--f) text-[13px] font-medium text-red-600 [&_svg]:size-4 [&_svg]:text-red-500 data-highlighted:bg-red-500/10 data-highlighted:text-red-700 data-highlighted:[&_svg]:text-red-600 dark:text-red-400 dark:data-highlighted:text-red-300"
                onclick={() => void signOutUser()}
              >
                <LogOutIcon />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      {:else}
        <div class="hidden md:flex items-center gap-3 text-sm">
          {@render themeButton()}
        </div>
      {/if}

      {@render menuButton()}
    </div>

    {#if mobileOpen}
      <div class="md:hidden absolute left-0 right-0 top-full border-b z-50 bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-800">
        {#if isWorkspace && workspaceId}
          <div class="px-4 py-2 text-xs truncate text-gray-500 dark:text-neutral-600">{workspaceId}</div>
        {/if}
        {@render mobileLinks(showAuthedControls ? getAuthedMobileLinks() : publicMobileLinks)}
        <div class="px-4 py-3 border-t border-gray-200 dark:border-neutral-800/50">
          {@render themeButton()}
        </div>
        <button
          type="button"
          onclick={() => {
            closeMobile();
            if (showAuthedControls) signOutUser();
          }}
          class="w-full text-left px-4 py-3 text-sm transition-colors cursor-pointer border-t text-gray-600 hover:text-red-500 hover:bg-gray-100 dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-neutral-800/30 border-gray-200 dark:border-neutral-800/50"
        >
          {showAuthedControls ? "sign out" : "close"}
        </button>
      </div>
    {/if}
  </nav>
