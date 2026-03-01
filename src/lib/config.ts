/**
 * filepath Global Configuration
 * 
 * This is the single source of truth for platform-wide defaults.
 * Change these values to update the entire platform + marketing.
 */

// Default LLM model for all filepath-native agents.
// This is stored exactly as selected and sent directly to the router.
export const DEFAULT_MODEL = "moonshotai/kimi-k2.5";

// Legacy alias kept for docs/examples that still reference the older constant name.
export const DEFAULT_MODEL_FULL = DEFAULT_MODEL;

// Human-readable name for UI display
export const DEFAULT_MODEL_NAME = "Kimi K2.5";

// Model provider
export const DEFAULT_MODEL_PROVIDER = "Moonshot AI";

// Platform defaults
export const PLATFORM_NAME = "filepath";
export const PLATFORM_URL = "https://myfilepath.com";
export const PLATFORM_DESCRIPTION = "Orchestrate AI coding agents in persistent containers";
