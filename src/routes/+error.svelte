<script lang="ts">
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import SEO from "$lib/components/SEO.svelte";

  let dark = $state(browser && document.documentElement.classList.contains('dark'));

  if (browser) {
    const observer = new MutationObserver(() => {
      dark = document.documentElement.classList.contains('dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  function getErrorTitle(status: number): string {
    switch (status) {
      case 404:
        return "Page Not Found";
      case 403:
        return "Access Denied";
      case 500:
        return "Server Error";
      default:
        return "Error";
    }
  }

  function getErrorDescription(status: number): string {
    switch (status) {
      case 404:
        return "The page you're looking for couldn't be found. It might have been moved or deleted.";
      case 403:
        return "You don't have permission to access this page. Please check your credentials.";
      case 500:
        return "Something went wrong on our end. Our team has been notified and we're working to fix it.";
      default:
        return "We're having trouble loading this page. You can try refreshing or going back to where you were.";
    }
  }

  let errorTitle = $derived(`${page.status} - ${getErrorTitle(page.status)}`);
  let errorMessage = $derived(getErrorTitle(page.status));
  let errorDescription = $derived(getErrorDescription(page.status));
</script>

<SEO
  title={`${errorTitle} | filepath`}
  description={errorDescription}
  keywords="filepath error"
  path={page.url.pathname}
  type="website"
  section="Error"
  tags="error"
  noindex
/>

<div class="min-h-screen flex items-center justify-center px-8 py-20 text-center gap-4 flex-col {dark ? 'bg-neutral-950 text-neutral-300' : 'bg-gray-50 text-gray-700'} transition-colors duration-200">
  <h1 class="text-6xl font-bold {dark ? 'text-indigo-400' : 'text-blue-600'}">{page.status}</h1>

  <p class="text-2xl font-semibold {dark ? 'text-neutral-100' : 'text-gray-900'}">
    {errorMessage}
  </p>

  <p class="text-xl {dark ? 'text-neutral-400' : 'text-gray-600'} text-balance max-w-lg mx-auto">
    {errorDescription}
  </p>

  <div class="flex gap-4 justify-center py-10 flex-col md:flex-row">
    <button
      onclick={() => history.back()}
      class="px-6 py-3 rounded-md text-sm font-medium border transition-colors cursor-pointer flex items-center justify-center gap-2 {dark ? 'bg-neutral-800 border-neutral-700 hover:border-neutral-600 text-neutral-300' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'}"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Go Back
    </button>

    <button
      onclick={() => location.reload()}
      class="px-6 py-3 rounded-md text-sm font-medium border transition-colors cursor-pointer flex items-center justify-center gap-2 {dark ? 'bg-neutral-800 border-neutral-700 hover:border-neutral-600 text-neutral-300' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700'}"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 8v5M21 8h-5"/>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M3 16v-5M3 16h5"/>
      </svg>
      Try Again
    </button>

    <a
      href="/"
      class="px-6 py-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 {dark ? 'bg-indigo-500 hover:bg-indigo-400 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}"
    >
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
      Go Home
    </a>
  </div>
</div>
