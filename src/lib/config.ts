/**
 * filepath Global Configuration
 * 
 * This is the single source of truth for platform-wide defaults.
 * Change these values to update the entire platform + marketing.
 */

// Default LLM model for all filepath-native agents
// This controls: agent catalog, spawn modal, API examples, docs
export const DEFAULT_MODEL = "kimi-k2.5";

// Full provider-prefixed version for API calls
export const DEFAULT_MODEL_FULL = "openrouter/kimi-k2.5";

// Human-readable name for UI display
export const DEFAULT_MODEL_NAME = "Kimi K2.5";

// Model provider
export const DEFAULT_MODEL_PROVIDER = "Moonshot AI";

// Platform defaults
export const PLATFORM_NAME = "filepath";
export const PLATFORM_URL = "https://myfilepath.com";
export const PLATFORM_DESCRIPTION = "Orchestrate AI coding agents in persistent containers";
