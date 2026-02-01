<script lang="ts">
  interface Props {
    current?: string | null;
    variant?: string;
  }
  
  let { current = null, variant = 'default' }: Props = $props();
  
  const navClasses = $derived(variant === 'centered' 
    ? 'border-b border-neutral-800 px-6 py-4 relative z-10 bg-neutral-950/50 backdrop-blur-sm'
    : 'border-b border-neutral-800 px-6 py-4 flex justify-between items-center');
  
  const innerClasses = $derived(variant === 'centered'
    ? 'flex items-center gap-2 justify-between max-w-2xl mx-auto'
    : '');
  
  function linkClass(page: string) {
    return current === page 
      ? 'text-neutral-100' 
      : 'hover:text-neutral-100';
  }
</script>

<nav class={navClasses}>
  <div class={innerClasses}>
    <a href="/" class="flex items-center gap-2">
      <svg width="24" height="24" viewBox="0 0 339 339" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M119.261 35C128.462 35.0001 137.256 38.8378 143.569 45.6083L160.108 63.3453C166.421 70.1159 175.215 73.9536 184.416 73.9536H298.583C317.039 73.9536 332 89.0902 332 107.762V270.191C332 288.863 317.039 304 298.583 304H41.417C22.9613 304 8 288.863 8 270.191V68.8087C8.0001 50.1368 22.9614 35 41.417 35H119.261ZM169.23 219.37V259.415H291.318V219.37H169.23ZM50.7361 111.182L110.398 171.838L51.027 226.311L79.9846 258.994L169.77 173.606L82.022 81.2961L50.7361 111.182Z" fill="currentColor"/>
      </svg>
      <span class="text-neutral-100 font-medium">myfilepath.com</span>
    </a>
    <div class="flex gap-6 text-sm">
      <a href="/docs" class={linkClass('docs')}>docs</a>
      <a href="/pricing" class={linkClass('pricing')}>pricing</a>
      <a href="/login" class={linkClass('login')}>login</a>
    </div>
  </div>
</nav>
