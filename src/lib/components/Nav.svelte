<script lang="ts">
  import { getContext } from "svelte";
  import { signOut } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import MenuIcon from "@lucide/svelte/icons/menu";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import SunMediumIcon from "@lucide/svelte/icons/sun-medium";
  import UserRoundIcon from "@lucide/svelte/icons/user-round";
  import XIcon from "@lucide/svelte/icons/x";
  import Button from "$lib/components/ui/button/button.svelte";

  interface Props {
    current?: string | null;
    variant?: "centered" | "dashboard" | "workspace";
    workspaceId?: string | null;
  }

  let { current = null, variant = "centered", workspaceId = null }: Props = $props();
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

  $effect(() => {
    syncThemeState();
  });

  const logo = `M119.261 35C128.462 35.0001 137.256 38.8378 143.569 45.6083L160.108 63.3453C166.421 70.1159 175.215 73.9536 184.416 73.9536H298.583C317.039 73.9536 332 89.0902 332 107.762V270.191C332 288.863 317.039 304 298.583 304H41.417C22.9613 304 8 288.863 8 270.191V68.8087C8.0001 50.1368 22.9614 35 41.417 35H119.261ZM169.23 219.37V259.415H291.318V219.37H169.23ZM50.7361 111.182L110.398 171.838L51.027 226.311L79.9846 258.994L169.77 173.606L82.022 81.2961L50.7361 111.182Z`;
  const iconButtonClass =
    "size-8 rounded-full border border-(--b1) bg-(--bg2)/90 text-(--t2) shadow-none hover:border-(--t4) hover:bg-(--bg3) hover:text-(--t1)";
  const ghostIconButtonClass =
    "size-8 rounded-full border border-transparent bg-transparent text-(--t2) shadow-none hover:bg-(--bg3) hover:text-(--t1)";
</script>

{#snippet logoIcon(size: number)}
  <svg width={size} height={size} viewBox="0 0 339 339" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d={logo} fill="currentColor" />
  </svg>
{/snippet}

{#snippet menuButton()}
  <Button
    onclick={() => (mobileOpen = !mobileOpen)}
    variant="ghost"
    size="icon-sm"
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

{#snippet themeButton()}
  <Button
    type="button"
    variant="outline"
    size="icon-sm"
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

{#snippet iconLink(href: string, label: string, icon: typeof ArrowLeftIcon)}
  {@const Icon = icon}
  <Button href={href} variant="outline" size="icon-sm" class={iconButtonClass} aria-label={label} title={label}>
    <Icon size={15} />
  </Button>
{/snippet}

{#snippet signOutButton()}
  <Button
    type="button"
    variant="outline"
    size="icon-sm"
    class={iconButtonClass}
    onclick={signOutUser}
    aria-label="Sign out"
    title="Sign out"
  >
    <LogOutIcon size={15} />
  </Button>
{/snippet}

{#if variant === "centered"}
  <nav class="border-b border-gray-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/50 px-6 py-4 relative z-50 backdrop-blur-sm">
    <div class="flex items-center justify-between max-w-6xl mx-auto">
      <a href="/" class="flex items-center gap-2">
        {@render logoIcon(24)}
        <span class="font-medium text-sm text-gray-900 dark:text-neutral-100">filepath</span>
      </a>

      <div class="hidden md:flex items-center gap-4 text-sm">
        <a href="/api/openapi.json" class="transition-colors text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100">api</a>
        <a href="https://github.com/acoyfellow/filepath" class="transition-colors text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100">github</a>
        <a
          href="/dashboard"
          class="px-3 py-1 rounded-full text-sm font-medium transition-colors bg-neutral-900 text-white hover:bg-black dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white"
        >
          dashboard
        </a>
        {@render themeButton()}
      </div>

      {@render menuButton()}
    </div>

    {#if mobileOpen}
      <div class="md:hidden absolute left-0 right-0 top-full border-b z-50 bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-800">
        {@render mobileLink("/api/openapi.json", "api", false)}
        {@render mobileLink("/dashboard", "dashboard", false)}
        <div class="px-4 py-3 border-t border-gray-200 dark:border-neutral-800/50">
          {@render themeButton()}
        </div>
      </div>
    {/if}
  </nav>
{:else if variant === "dashboard"}
  <nav class="border-b border-gray-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 px-6 py-3 backdrop-blur-sm relative z-50">
    <div class="max-w-6xl mx-auto flex items-center justify-between">
      <a href="/dashboard" class="flex items-center gap-2 shrink-0">
        {@render logoIcon(20)}
        <span class="font-medium text-sm text-gray-900 dark:text-neutral-100">filepath</span>
      </a>

      <div class="hidden md:flex items-center gap-3 text-sm">
        {@render iconLink("/settings/api-keys", "API keys", KeyRoundIcon)}
        {@render iconLink("/settings/account", "Account", UserRoundIcon)}
        {@render themeButton()}
        {@render signOutButton()}
      </div>

      {@render menuButton()}
    </div>

    {#if mobileOpen}
      <div class="md:hidden absolute left-0 right-0 top-full border-b z-50 bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-800">
        {@render mobileLink("/dashboard", "workspaces", current === "dashboard")}
        {@render mobileLink("/settings/api-keys", "api keys", current === "api-keys")}
        {@render mobileLink("/settings/account", "account", current === "account")}
        <div class="px-4 py-3 border-t border-gray-200 dark:border-neutral-800/50">
          {@render themeButton()}
        </div>
        <button
          type="button"
          onclick={() => {
            closeMobile();
            signOutUser();
          }}
          class="w-full text-left px-4 py-3 text-sm transition-colors cursor-pointer border-t text-gray-600 hover:text-red-500 hover:bg-gray-100 dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-neutral-800/30 border-gray-200 dark:border-neutral-800/50"
        >
          sign out
        </button>
      </div>
    {/if}
  </nav>
{:else if variant === "workspace"}
  <header class="sticky top-0 z-50 flex items-center justify-between border-b border-gray-200 bg-white/80 px-4 py-2 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-950/80">
    <div class="flex items-center gap-2 min-w-0">
      <Button
        href="/dashboard"
        variant="ghost"
        size="icon-sm"
        class={ghostIconButtonClass}
        aria-label="Back to dashboard"
        title="Back to dashboard"
      >
        <ArrowLeftIcon size={16} />
      </Button>
      <a href="/dashboard" class="flex items-center gap-2 shrink-0 text-gray-900 dark:text-neutral-100" aria-label="Go to dashboard" title="Go to dashboard">
        {@render logoIcon(16)}
      </a>
    </div>

    <div class="hidden md:flex items-center gap-3 text-sm">
      {@render iconLink("/settings/api-keys", "API keys", KeyRoundIcon)}
      {@render iconLink("/settings/account", "Account", UserRoundIcon)}
      {@render themeButton()}
      {@render signOutButton()}
    </div>

    {@render menuButton()}

    {#if mobileOpen}
      <div class="md:hidden absolute left-0 right-0 top-full border-b z-50 bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-800">
        {#if workspaceId}
          <div class="px-4 py-2 text-xs truncate text-gray-500 dark:text-neutral-600">{workspaceId}</div>
        {/if}
        {@render mobileLink("/dashboard", "workspaces", false)}
        {@render mobileLink("/settings/api-keys", "api keys", false)}
        {@render mobileLink("/settings/account", "account", false)}
        <div class="px-4 py-3 border-t border-gray-200 dark:border-neutral-800/50">
          {@render themeButton()}
        </div>
        <button
          type="button"
          onclick={() => {
            closeMobile();
            signOutUser();
          }}
          class="w-full text-left px-4 py-3 text-sm transition-colors cursor-pointer border-t text-gray-600 hover:text-red-500 hover:bg-gray-100 dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-neutral-800/30 border-gray-200 dark:border-neutral-800/50"
        >
          sign out
        </button>
      </div>
    {/if}
  </header>
{/if}
