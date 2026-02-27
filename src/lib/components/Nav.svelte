<script lang="ts">
  import { signOut } from '$lib/auth-client';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  const THEME_KEY = 'filepath-theme';

  interface Props {
    current?: string | null;
    variant?: 'centered' | 'dashboard' | 'session';
    email?: string | null;
    sessionId?: string | null;
  }
  
  let { current = null, variant = 'centered', email = null, sessionId = null }: Props = $props();
  let mobileOpen = $state(false);
  let dark = $state(browser && document.documentElement.classList.contains('dark'));

  function toggleTheme() {
    dark = !dark;
    if (browser) {
      document.documentElement.classList.toggle('dark', dark);
      try { localStorage.setItem(THEME_KEY, dark ? '1' : '0'); } catch {}
    }
  }

  if (browser) {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored !== null) {
      const isDark = stored === '1';
      dark = isDark;
      document.documentElement.classList.toggle('dark', isDark);
    }
  }

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
  <svg width={size} height={size} viewBox="0 0 339 339" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d={logo} fill="currentColor"/>
  </svg>
{/snippet}

{#snippet hamburger()}
  <button
    onclick={() => mobileOpen = !mobileOpen}
    class="md:hidden p-2 -mr-2 text-neutral-400 hover:text-neutral-100 transition-colors cursor-pointer"
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
    class="block px-4 py-3 text-sm transition-colors {active ? 'text-neutral-100 bg-neutral-800/50' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/30'}"
  >{label}</a>
{/snippet}

{#snippet themeButton(isDark: boolean)}
  <button type="button" class="nav-theme" onclick={toggleTheme} title={isDark ? "Light mode" : "Dark mode"}>
    {#if isDark}
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
        <circle cx="8" cy="8" r="3.5" />
        <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" />
      </svg>
    {:else}
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
        <path d="M13.5 8.5a5.5 5.5 0 01-7-7 6 6 0 107 7z" />
      </svg>
    {/if}
  </button>
{/snippet}

<!-- Logged-out (centered) nav -->
{#if variant === 'centered'}
  <nav class="border-b border-neutral-800 px-6 py-4 relative z-50 bg-neutral-950/50 backdrop-blur-sm">
    <div class="flex items-center justify-between max-w-6xl mx-auto">
      <a href="/" class="flex items-center gap-2">
        {@render logoIcon(24)}
        <span class="text-neutral-100 font-medium">filepath</span>
      </a>

      <!-- Desktop links -->
      <div class="hidden md:flex items-center gap-4 text-sm">
        <a href="/docs" class="text-neutral-400 hover:text-neutral-100 transition-colors" class:text-neutral-100={current === 'docs'}>docs</a>
        <a href="/pricing" class="text-neutral-400 hover:text-neutral-100 transition-colors" class:text-neutral-100={current === 'pricing'}>pricing</a>
        <a href="/login" class="text-neutral-400 hover:text-neutral-100 transition-colors" class:text-neutral-100={current === 'login'}>login</a>
        <a href="/signup" class="bg-neutral-100 text-neutral-900 px-3 py-1 rounded text-sm font-medium hover:bg-white transition-colors">sign up</a>
        {@render themeButton(dark)}
      </div>

      {@render hamburger()}
    </div>

    <!-- Mobile dropdown -->
    {#if mobileOpen}
      <div class="md:hidden absolute left-0 right-0 top-full bg-neutral-950 border-b border-neutral-800 z-50">
        {@render mobileLink('/docs', 'docs', current === 'docs')}
        {@render mobileLink('/pricing', 'pricing', current === 'pricing')}
        {@render mobileLink('/login', 'login', current === 'login')}
        {@render mobileLink('/signup', 'sign up', current === 'signup')}
        <div class="px-4 py-3 border-t border-neutral-800/50">
          {@render themeButton(dark)}
        </div>
      </div>
    {/if}
  </nav>

<!-- Logged-in (dashboard) nav -->
{:else if variant === 'dashboard'}
  <nav class="border-b border-neutral-800 px-6 py-3 bg-neutral-950/80 backdrop-blur-sm relative z-50">
    <div class="max-w-6xl mx-auto flex items-center justify-between">
      <a href="/dashboard" class="flex items-center gap-2 shrink-0">
        {@render logoIcon(20)}
        <span class="text-neutral-100 font-medium text-sm">filepath</span>
      </a>

      <!-- Desktop links -->
      <div class="hidden md:flex items-center gap-5 text-sm">
        <a href="/settings/api-keys" class="text-neutral-400 hover:text-neutral-100 transition-colors" class:text-neutral-100={current === 'api-keys'}>keys</a>

        <a href="/settings/account" class="text-neutral-400 hover:text-neutral-100 transition-colors" class:text-neutral-100={current === 'account'}>account</a>
        {#if email}
          <span class="text-neutral-600 text-xs truncate max-w-[180px]">{email}</span>
        {/if}
        {@render themeButton(dark)}
        <button
          onclick={signOutUser}
          class="text-neutral-500 hover:text-neutral-100 transition-colors cursor-pointer"
        >sign out</button>
      </div>

      {@render hamburger()}
    </div>

    <!-- Mobile dropdown -->
    {#if mobileOpen}
      <div class="md:hidden absolute left-0 right-0 top-full bg-neutral-950 border-b border-neutral-800 z-50">
        {@render mobileLink('/dashboard', 'sessions', current === 'sessions')}
        {@render mobileLink('/settings/api-keys', 'api keys', current === 'api-keys')}

        {@render mobileLink('/settings/account', 'account', current === 'account')}
        {#if email}
          <div class="px-4 py-2 text-xs  text-neutral-600 truncate border-t border-neutral-800/50">{email}</div>
        {/if}
        <div class="px-4 py-3 border-t border-neutral-800/50">
          {@render themeButton(dark)}
        </div>
        <button
          onclick={() => { closeMobile(); signOutUser(); }}
          class="w-full text-left px-4 py-3 text-sm text-neutral-500 hover:text-red-400 hover:bg-neutral-800/30 transition-colors cursor-pointer border-t border-neutral-800/50"
        >sign out</button>
      </div>
    {/if}
  </nav>

<!-- Session nav -->
{:else if variant === 'session'}
  <header class="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-sm relative z-50">
    <div class="flex items-center gap-3 min-w-0">
      <a href="/dashboard" class="flex items-center gap-2 text-neutral-400 hover:text-neutral-100 transition-colors text-sm shrink-0">
        {@render logoIcon(16)}
					<span class="hidden sm:inline">dashboard</span>
					<span class="sm:hidden">back</span>
      </a>
      {#if sessionId}
        <span class="text-neutral-700 hidden sm:inline">|</span>
        <span class=" text-xs text-neutral-500 truncate hidden sm:inline">{sessionId}</span>
      {/if}
    </div>
    
    <!-- Desktop links -->
    <div class="hidden md:flex items-center gap-5 text-sm">
      <a href="/settings/api-keys" class="text-neutral-400 hover:text-neutral-100 transition-colors">keys</a>

      <a href="/settings/account" class="text-neutral-400 hover:text-neutral-100 transition-colors">account</a>
      {#if email}
        <span class="text-neutral-600  text-xs truncate max-w-[180px]">{email}</span>
      {/if}
      {@render themeButton(dark)}
      <button
        onclick={signOutUser}
        class="text-neutral-500 hover:text-neutral-100 transition-colors cursor-pointer"
      >sign out</button>
    </div>

    {@render hamburger()}

    <!-- Mobile dropdown -->
    {#if mobileOpen}
      <div class="md:hidden absolute left-0 right-0 top-full bg-neutral-950 border-b border-neutral-800 z-50">
        {#if sessionId}
          <div class="px-4 py-2 text-xs  text-neutral-600 truncate">{sessionId}</div>
        {/if}
        {@render mobileLink('/dashboard', 'sessions', false)}
        {@render mobileLink('/settings/api-keys', 'api keys', false)}

        {@render mobileLink('/settings/account', 'account', false)}
        {#if email}
          <div class="px-4 py-2 text-xs  text-neutral-600 truncate border-t border-neutral-800/50">{email}</div>
        {/if}
        <div class="px-4 py-3 border-t border-neutral-800/50">
          {@render themeButton(dark)}
        </div>
        <button
          onclick={() => { closeMobile(); signOutUser(); }}
          class="w-full text-left px-4 py-3 text-sm text-neutral-500 hover:text-red-400 hover:bg-neutral-800/30 transition-colors cursor-pointer border-t border-neutral-800/50"
        >sign out</button>
      </div>
    {/if}
  </header>
{/if}

<style>
  .nav-theme {
    background: none;
    border: 1px solid var(--b1, rgb(38 38 38));
    border-radius: 5px;
    width: 28px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--t4, rgb(113 113 122));
    transition: border-color 0.1s;
  }
  .nav-theme:hover {
    border-color: var(--t5, rgb(161 161 170));
  }
</style>
