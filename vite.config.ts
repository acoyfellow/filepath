import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	ssr: {
		// Don't bundle Cloudflare-specific modules - they're provided at runtime
		external: ['@cloudflare/sandbox', '@cloudflare/containers', 'cloudflare:workers']
	}
});
