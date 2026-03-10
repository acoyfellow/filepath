<script lang="ts">
  import { getContext } from 'svelte';
  import { signOut } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  interface Props {
    current?: string | null;
    variant?: 'centered' | 'dashboard' | 'session';
    sessionId?: string | null;
  }

  let { current = null, variant = 'centered', sessionId = null }: Props = $props();
  const { toggleTheme } = getContext<{ toggleTheme: () => void }>('theme');
  let mobileOpen = $state(false);

  async function signOutUser() {
    try {
      await signOut();
      goto('/');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }

  function closeMobile() {
    mobileOpen = false;
  }

  const logo = `M119.261 35C128.462 35.0001 137.256 38.8378 143.569 45.6083L160.108 63.3453C166.421 70.1159 175.215 73.9536 184.416 73.9536H298.583C317.039 73.9536 332 89.0902 332 107.762V270.191C332 288.863 317.039 304 298.583 304H41.417C22.9613 304 8 288.863 8 270.191V68.8087C8.0001 50.1368 22.9614 35 41.417 35H119.261ZM169.23 219.37V259.415H291.318V219.37H169.23ZM50.7361 111.182L110.398 171.838L51.027 226.311L79.9846 258.994L169.77 173.606L82.022 81.2961L50.7361 111.182Z`;

  const isAuthed = $derived(variant === 'dashboard' || variant === 'session');
  const homeHref = $derived(isAuthed ? '/dashboard' : '/');
</script>

{#snippet logoIcon(size: number)}
  <svg width={size} height={size} viewBox="0 0 339 339" fill="none" xmlns="http://www.w3.org/2000/svg" class="dark:invert">
    <path fill-rule="evenodd" clip-rule="evenodd" d={logo} fill="currentColor"/>
  </svg>
{/snippet}

{#snippet hamburger()}
  <button
    onclick={() => mobileOpen = !mobileOpen}
    class="md:hidden p-2 -mr-2 text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors cursor-pointer"
    aria-label="Toggle menu"
    aria-expanded={mobileOpen}
  >
    {#if mobileOpen}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    {:else}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    {/if}
  </button>
{/snippet}

{#snippet mobileLink(href: string, label: string, active: boolean)}
  <a
    {href}
    onclick={closeMobile}
    class="block px-4 py-3 text-sm transition-colors {active
      ? 'text-gray-900 bg-gray-100 dark:text-neutral-100 dark:bg-neutral-800/50'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800/30'}"
  >{label}</a>
{/snippet}

{#snippet themeButton()}
  <button type="button" class="nav-theme" onclick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
    <span class="block dark:hidden">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
        <path d="M13.5 8.5a5.5 5.5 0 01-7-7 6 6 0 107 7z" />
      </svg>
    </span>
    <span class="hidden dark:block">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
        <circle cx="8" cy="8" r="3.5" />
        <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" />
      </svg>
    </span>
  </button>
{/snippet}

<!-- Logged-out (centered) nav -->
{#if variant === 'centered'}
  <nav class="border-b border-gray-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/50 px-6 py-4 relative z-50 backdrop-blur-sm">
    <div class="flex items-center justify-between max-w-6xl mx-auto">
      <a href="/" class="flex items-center gap-2">
        {@render logoIcon(24)}
        <span class="font-medium text-sm text-gray-900 dark:text-neutral-100">filepath</span>
      </a>

      <!-- Desktop links -->
      <div class="hidden md:flex items-center gap-4 text-sm">
        <a
          href="/docs"
          class="transition-colors {current === 'docs' ? 'text-gray-900 dark:text-neutral-100' : 'text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100'}"
        >docs</a>
        <a
          href="/pricing"
          class="transition-colors {current === 'pricing' ? 'text-gray-900 dark:text-neutral-100' : 'text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100'}"
        >pricing</a>
        <a
          href="/login"
          class="transition-colors {current === 'login' ? 'text-gray-900 dark:text-neutral-100' : 'text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100'}"
        >login</a>
        <a
          href="/signup"
          class="px-3 py-1 rounded text-sm font-medium transition-colors bg-neutral-900 text-white hover:bg-black dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white"
        >sign up</a>
        {@render themeButton()}
      </div>

      {@render hamburger()}
    </div>

    <!-- Mobile dropdown -->
    {#if mobileOpen}
      <div class="md:hidden absolute left-0 right-0 top-full border-b z-50 bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-800">
        {@render mobileLink('/docs', 'docs', current === 'docs')}
        {@render mobileLink('/pricing', 'pricing', current === 'pricing')}
        {@render mobileLink('/login', 'login', current === 'login')}
        {@render mobileLink('/signup', 'sign up', current === 'signup')}
        <div class="px-4 py-3 border-t border-gray-200 dark:border-neutral-800/50">
          {@render themeButton()}
        </div>
      </div>
    {/if}
  </nav>

<!-- Logged-in (dashboard) nav -->
{:else if variant === 'dashboard'}
  <nav class="border-b border-gray-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 px-6 py-3 backdrop-blur-sm relative z-50">
    <div class="max-w-6xl mx-auto flex items-center justify-between">
      <a href="/dashboard" class="flex items-center gap-2 shrink-0">
        {@render logoIcon(20)}
        <span class="font-medium text-sm text-gray-900 dark:text-neutral-100">filepath</span>
      </a>

      <!-- Desktop links -->
      <div class="hidden md:flex items-center gap-5 text-sm">
        <a
          href="/settings/api-keys"
          class="transition-colors {current === 'api-keys' ? 'text-gray-900 dark:text-neutral-100' : 'text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100'}"
        >keys</a>

        <a
          href="/settings/account"
          class="transition-colors {current === 'account' ? 'text-gray-900 dark:text-neutral-100' : 'text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100'}"
        >account</a>

        {@render themeButton()}
        <button
          onclick={signOutUser}
          class="transition-colors cursor-pointer text-gray-600 hover:text-gray-900 dark:text-neutral-500 dark:hover:text-neutral-100"
        >sign out</button>
      </div>

      {@render hamburger()}
    </div>

    <!-- Mobile dropdown -->
    {#if mobileOpen}
      <div class="md:hidden absolute left-0 right-0 top-full border-b z-50 bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-800">
        {@render mobileLink('/dashboard', 'sessions', current === 'sessions')}
        {@render mobileLink('/settings/api-keys', 'api keys', current === 'api-keys')}

        {@render mobileLink('/settings/account', 'account', current === 'account')}

        <div class="px-4 py-3 border-t border-gray-200 dark:border-neutral-800/50">
          {@render themeButton()}
        </div>
        <button
          onclick={() => { closeMobile(); signOutUser(); }}
          class="w-full text-left px-4 py-3 text-sm transition-colors cursor-pointer border-t text-gray-600 hover:text-red-500 hover:bg-gray-100 dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-neutral-800/30 border-gray-200 dark:border-neutral-800/50"
        >sign out</button>
      </div>
    {/if}
  </nav>

<!-- Session nav -->
{:else if variant === 'session'}
  <header class="flex items-center justify-between px-4 py-2 border-b backdrop-blur-sm relative z-50 border-gray-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80">
    <div class="flex items-center gap-3 min-w-0">
      <a href="/dashboard" class="flex items-center gap-2 transition-colors text-sm shrink-0 text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100">
        {@render logoIcon(16)}
        <span class="sm:hidden">back</span>
      </a>
      
    </div>

    <!-- Desktop links -->
    <div class="hidden md:flex items-center gap-5 text-sm">
      <a href="/settings/api-keys" class="transition-colors text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100">keys</a>

      <a href="/settings/account" class="transition-colors text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100">account</a>

      {@render themeButton()}
      <button
        onclick={signOutUser}
        class="transition-colors cursor-pointer text-gray-600 hover:text-gray-900 dark:text-neutral-500 dark:hover:text-neutral-100"
      >sign out</button>
    </div>

    {@render hamburger()}

    <!-- Mobile dropdown -->
    {#if mobileOpen}
      <div class="md:hidden absolute left-0 right-0 top-full border-b z-50 bg-white dark:bg-neutral-950 border-gray-200 dark:border-neutral-800">
        {#if sessionId}
          <div class="px-4 py-2 text-xs truncate text-gray-500 dark:text-neutral-600">{sessionId}</div>
        {/if}
        {@render mobileLink('/dashboard', 'sessions', false)}
        {@render mobileLink('/settings/api-keys', 'api keys', false)}

        {@render mobileLink('/settings/account', 'account', false)}

        <div class="px-4 py-3 border-t border-gray-200 dark:border-neutral-800/50">
          {@render themeButton()}
        </div>
        <button
          onclick={() => { closeMobile(); signOutUser(); }}
          class="w-full text-left px-4 py-3 text-sm transition-colors cursor-pointer border-t text-gray-600 hover:text-red-500 hover:bg-gray-100 dark:text-neutral-500 dark:hover:text-red-400 dark:hover:bg-neutral-800/30 border-gray-200 dark:border-neutral-800/50"
        >sign out</button>
      </div>
    {/if}
  </header>
{/if}

<style>
  .nav-theme {
    background: none;
    border: 1px solid rgb(229 231 235);
    border-radius: 5px;
    width: 28px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: rgb(107 114 128);
    transition: border-color 0.1s;
  }
  .nav-theme:hover {
    border-color: rgb(156 163 175);
  }
  :global(.dark) .nav-theme {
    border-color: rgb(38 38 38);
    color: rgb(113 113 122);
  }
  :global(.dark) .nav-theme:hover {
    border-color: rgb(161 161 170);
  }
</style>
