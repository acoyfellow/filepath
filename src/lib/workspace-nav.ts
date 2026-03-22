import { writable } from "svelte/store";

/** Set by workspace `[id]` page so Nav can open the create-conversation modal. Cleared on page destroy. */
export const workspaceNewConversationHandler = writable<(() => void) | null>(null);
