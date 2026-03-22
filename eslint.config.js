import eslint from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			".svelte-kit/**",
			"build/**",
			"node_modules/**",
			"dist/**",
			"coverage/**",
			".alchemy/**",
			".wrangler/**",
			".output/**",
			".vercel/**",
			".netlify/**",
		],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs["flat/recommended"],
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			// SvelteKit apps mix internal routes, anchors, and external URLs; `resolve()` is optional.
			"svelte/no-navigation-without-resolve": "off",
			"svelte/require-each-key": "warn",
			"svelte/no-at-html-tags": "warn",
			"svelte/prefer-svelte-reactivity": "off",
			"svelte/no-unused-svelte-ignore": "warn",
			"svelte/no-useless-mustaches": "warn",
		},
	},
	{
		files: ["**/*.svelte"],
		rules: {
			// Common with `bind:this` / forwarded refs
			"no-useless-assignment": "off",
		},
	},
	{
		files: ["**/*.svelte", "**/*.svelte.ts"],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser,
			},
		},
	},
);
