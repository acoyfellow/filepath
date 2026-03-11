import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { existsSync } from 'node:fs';

const verifyBuild = process.env.FILEPATH_VERIFY_BUILD === '1';
const alchemy = verifyBuild
	? null
	: (await import('alchemy/cloudflare/sveltekit')).default;
const localPlatformProxyConfig = './.alchemy/local/sveltekit-wrangler.jsonc';
const fallbackPlatformProxyConfig = './.alchemy/local/wrangler.jsonc';

const verifyAdapter = {
	name: 'filepath-verify-adapter',
	async adapt() {}
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: { 
		adapter: verifyBuild
			? verifyAdapter
			: alchemy({
					platformProxy: {
						configPath: existsSync(localPlatformProxyConfig)
							? localPlatformProxyConfig
							: fallbackPlatformProxyConfig
					}
				})
  },
  compilerOptions: {
		experimental: {
			async: true
		}
	},
  alias: {
    $shared: 'shared'
  }
};

export default config;
