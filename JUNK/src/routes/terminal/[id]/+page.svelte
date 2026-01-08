<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import { Share2, Check, X, Plus } from "@lucide/svelte";
  import { AGENT_LIST } from "$lib/agents";
  import { cn } from "$lib/utils";
  import { onMount } from "svelte";
  import { browser, dev } from "$app/environment";
  import { getApiUrl } from "$lib/api-utils";

  // Action to focus input when editing starts
  function autofocus(node: HTMLInputElement) {
    node.focus();
    node.select();
    return {};
  }
  import { page } from "$app/state";

  interface Tab {
    id: string;
    name: string;
  }

  let tabs = $state<Tab[]>([]);
  let activeTabId = $state<string | null>(null);
  let editingTabId = $state<string | null>(null);
  let editedTabName = $state<string>("");
  let copied = $state(false);
  let tabStateWs: WebSocket | null = null;
  let tabStateSyncAttempts = 0;
  let tabStateRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  const MAX_TAB_STATE_SYNC_ATTEMPTS = 3; // Reduced from 10 to 3

  const sessionId = $derived(page.params.id);

  let sessionHasPassword = $state(false);
  let showPasswordPrompt = $state(false);
  let passwordInput = $state("");
  let passwordError = $state<string | null>(null);
  let reconnectTabStateWs = $state<(() => void) | null>(null);

  // Get password header from sessionStorage
  function getPasswordHeader(): Record<string, string> {
    if (!browser || !sessionId) return {};
    const password = sessionStorage.getItem(`session:${sessionId}:password`);
    if (password) {
      return { "X-Session-Password": password };
    }
    return {};
  }

  // Load session info (agents, createdAt, TTL) from server
  async function loadSessionInfo() {
    if (!browser || !sessionId) return;
    try {
      const headers = getPasswordHeader();
      const res = await fetch(getApiUrl(`/session/${sessionId}/info`), {
        headers,
      });
      if (res.status === 401) {
        // Password required or invalid
        sessionStorage.removeItem(`session:${sessionId}:password`);
        const data = (await res.json()) as { hasPassword?: boolean };
        if (data.hasPassword) {
          sessionHasPassword = true;
          showPasswordPrompt = true;
        }
        return;
      }
      if (res.ok) {
        const info = (await res.json()) as {
          createdAt: number;
          lastActivity?: number;
          age: number;
          ttl: number;
          timeUntilSleep: number;
          hasPassword?: boolean;
        };
        sessionHasPassword = info.hasPassword || false;
      }
    } catch (err) {
      console.error("Failed to load session info:", err);
    }
  }

  // Handle password submission
  async function submitPassword() {
    if (!browser || !sessionId || !passwordInput.trim()) return;
    passwordError = null;

    // Store password in sessionStorage
    sessionStorage.setItem(`session:${sessionId}:password`, passwordInput);

    // Test password by fetching session info
    const headers = getPasswordHeader();
    const res = await fetch(getApiUrl(`/session/${sessionId}/info`), {
      headers,
    });

    if (res.status === 401) {
      passwordError = "Invalid password";
      sessionStorage.removeItem(`session:${sessionId}:password`);
      return;
    }

    if (res.ok) {
      showPasswordPrompt = false;
      passwordInput = "";
      // Reload session info with password
      await loadSessionInfo();
      // Reconnect WebSocket with password
      if (reconnectTabStateWs) {
        reconnectTabStateWs();
      }
    }
  }

  const activeAgents = $derived(AGENT_LIST);

  // const activeTab = $derived(tabs.find((t) => t.id === activeTabId) || null);

  const shareUrl = $derived.by(() => {
    if (!browser) return "";
    return window.location.href;
  });

  async function copyShareUrl() {
    if (!browser) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  // Persist tabs to server (shared across all browsers)
  async function saveTabsToStorage() {
    if (!browser || !sessionId) return;
    const tabData = tabs.map((tab) => ({
      id: tab.id,
      name: tab.name,
    }));

    // Save to server
    try {
      const headers = {
        "Content-Type": "application/json",
        ...getPasswordHeader(),
      };
      const res = await fetch(getApiUrl(`/session/${sessionId}/tabs`), {
        method: "POST",
        headers,
        body: JSON.stringify({ tabs: tabData, activeTab: activeTabId }),
      });
      if (res.status === 401) {
        sessionStorage.removeItem(`session:${sessionId}:password`);
        showPasswordPrompt = true;
      }
    } catch (err) {
      console.error("Failed to save tabs to server:", err);
    }

    // Also save to localStorage for cross-tab sync in same browser
    localStorage.setItem(`tabs:${sessionId}`, JSON.stringify(tabData));
    localStorage.setItem(`activeTab:${sessionId}`, activeTabId || "");
  }

  // Load tabs from server (shared across all browsers)
  async function loadTabsFromStorage(): Promise<
    Array<{ id: string; name: string }>
  > {
    if (!browser || !sessionId) return [];
    try {
      const headers = getPasswordHeader();
      const res = await fetch(getApiUrl(`/session/${sessionId}/tabs`), {
        headers,
      });
      if (res.status === 401) {
        sessionStorage.removeItem(`session:${sessionId}:password`);
        showPasswordPrompt = true;
        return [];
      }
      if (res.ok) {
        const data = (await res.json()) as {
          tabs: Array<{ id: string; name: string }>;
          activeTab?: string;
        };
        if (data.tabs && Array.isArray(data.tabs) && data.tabs.length > 0) {
          if (data.activeTab) {
            activeTabId = data.activeTab;
          }
          return data.tabs;
        }
      }
    } catch (err) {
      console.error("Failed to load tabs from server:", err);
    }

    // Fallback to localStorage if server fails
    try {
      const stored = localStorage.getItem(`tabs:${sessionId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.error("Failed to load tabs from localStorage:", err);
    }
    return [];
  }

  // Restore tabs from storage
  async function restoreTabs() {
    if (!browser || !sessionId) return;
    const storedTabs = await loadTabsFromStorage();
    if (storedTabs.length > 0) {
      tabs = storedTabs.map((stored) => ({
        id: stored.id,
        name: stored.name,
      }));
      // Active tab is set in loadTabsFromStorage
      if (!activeTabId && tabs.length > 0) {
        activeTabId = tabs[0].id;
      }
    }
  }

  async function createTab(name?: string): Promise<string> {
    // Always check storage first to ensure we're in sync
    const storedTabs = await loadTabsFromStorage();
    if (storedTabs.length > tabs.length) {
      // Storage has more tabs than we do - restore from storage first
      await restoreTabs();
    }

    const tabId = crypto.randomUUID();
    const tab: Tab = {
      id: tabId,
      name: name || `${tabs.length + 1}`,
    };
    tabs = [...tabs, tab];
    activeTabId = tabId;
    await saveTabsToStorage();
    return tabId;
  }

  async function closeTab(tabId: string) {
    tabs = tabs.filter((t) => t.id !== tabId);
    if (activeTabId === tabId) {
      activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
    }
    await saveTabsToStorage();
  }

  async function switchTab(tabId: string) {
    activeTabId = tabId;
    await saveTabsToStorage();
  }

  function startEditingTab(tabId: string, currentName: string) {
    editingTabId = tabId;
    editedTabName = currentName;
  }

  async function saveTabName(tabId: string) {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab && editedTabName.trim()) {
      tab.name = editedTabName.trim();
      tabs = [...tabs]; // Trigger reactivity
      await saveTabsToStorage();
    }
    editingTabId = null;
    editedTabName = "";
  }

  function cancelEditingTab() {
    editingTabId = null;
    editedTabName = "";
  }

  // Get iframe src for a tab
  function getIframeSrc(tabId: string): string {
    const password = browser
      ? sessionStorage.getItem(`session:${sessionId}:password`)
      : null;
    const passwordParam = password
      ? `&password=${encodeURIComponent(password)}`
      : "";
    return `/terminal/${sessionId}/tab?tab=${tabId}${passwordParam}`;
  }

  let infoInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    if (!browser || !sessionId) return;

    // Load session info (agents, createdAt, TTL) - only need to sync periodically
    loadSessionInfo().then(() => {
      // Check if password is required after loading session info
      if (
        sessionHasPassword &&
        !sessionStorage.getItem(`session:${sessionId}:password`)
      ) {
        showPasswordPrompt = true;
      }
    });
    // Refresh session info every 60 seconds to sync with server (age calculated locally)
    infoInterval = setInterval(loadSessionInfo, 60000); // Reduced frequency from 30s to 60s

    // Restore tabs from server (shared across browsers)
    (async () => {
      await restoreTabs();

      // If no tabs were restored, create initial tab
      if (tabs.length === 0) {
        await createTab();
      }
    })();

    // WebSocket for real-time tab state sync (cross-browser)
    const connectTabStateSync = () => {
      if (!browser || !sessionId) return;

      // Don't connect if password is required but not available
      if (
        sessionHasPassword &&
        !sessionStorage.getItem(`session:${sessionId}:password`)
      ) {
        // Wait for password to be set
        setTimeout(connectTabStateSync, 500);
        return;
      }

      const password = sessionStorage.getItem(`session:${sessionId}:password`);
      const passwordParam = password
        ? `?password=${encodeURIComponent(password)}`
        : "";
      let wsUrl: string;
      if (dev) {
        wsUrl = `ws://localhost:1337/session/${sessionId}/tabs/ws${passwordParam}`;
      } else {
        wsUrl = `wss://api.myfilepath.com/session/${sessionId}/tabs/ws${passwordParam}`;
      }

      tabStateWs = new WebSocket(wsUrl);

      tabStateWs.onopen = () => {
        console.log("Tab state WebSocket connected");
        tabStateSyncAttempts = 0;
      };

      tabStateWs.onmessage = (e) => {
        try {
          const message = JSON.parse(e.data);

          // Handle tab state updates
          const data = message as {
            tabs: Array<{ id: string; name: string }>;
            activeTab?: string;
          };

          if (data.tabs && Array.isArray(data.tabs)) {
            // Check if tabs changed
            const currentTabIds = tabs.map((t) => t.id).join(",");
            const serverTabIds = data.tabs.map((t) => t.id).join(",");
            const currentNames = tabs.map((t) => `${t.id}:${t.name}`).join(",");
            const serverNames = data.tabs
              .map((t) => `${t.id}:${t.name}`)
              .join(",");

            if (
              currentTabIds !== serverTabIds ||
              currentNames !== serverNames
            ) {
              // Server has different tabs - update from server
              tabs = data.tabs.map((stored) => ({
                id: stored.id,
                name: stored.name,
              }));
            }

            // Update active tab if different
            if (
              data.activeTab &&
              data.activeTab !== activeTabId &&
              tabs.some((t) => t.id === data.activeTab)
            ) {
              activeTabId = data.activeTab;
            }
          }
        } catch (err) {
          console.error("Failed to parse tab state update:", err);
        }
      };

      tabStateWs.onerror = (err) => {
        console.error("Tab state WebSocket error:", err);
        // Don't retry on error - let onclose handle it
      };

      tabStateWs.onclose = (event) => {
        console.log("Tab state WebSocket closed", event.code, event.reason);

        // Normal close codes - don't retry
        if (event.code === 1000 || event.code === 1001) {
          return;
        }

        // Prevent duplicate retries
        if (tabStateRetryTimeout) {
          clearTimeout(tabStateRetryTimeout);
        }

        tabStateSyncAttempts++;
        if (tabStateSyncAttempts < MAX_TAB_STATE_SYNC_ATTEMPTS) {
          const delay = Math.min(
            5000 * Math.pow(2, tabStateSyncAttempts), // Start at 5s instead of 1s
            60000 // Max 60s instead of 30s
          );
          tabStateRetryTimeout = setTimeout(connectTabStateSync, delay);
        }
      };
    };

    connectTabStateSync();
    reconnectTabStateWs = () => {
      if (tabStateWs) {
        tabStateWs.close();
      } else {
        connectTabStateSync();
      }
    };

    // Listen for storage changes to sync across browser tabs (same browser)
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || !e.newValue) return;

      if (e.key === `tabs:${sessionId}`) {
        try {
          const storedTabs = JSON.parse(e.newValue) as Array<{
            id: string;
            name: string;
          }>;

          const currentTabIds = tabs.map((t) => t.id).join(",");
          const newTabIds = storedTabs.map((t) => t.id).join(",");
          const currentNames = tabs.map((t) => `${t.id}:${t.name}`).join(",");
          const newNames = storedTabs.map((t) => `${t.id}:${t.name}`).join(",");

          if (currentTabIds !== newTabIds || currentNames !== newNames) {
            tabs = storedTabs.map((t) => ({ id: t.id, name: t.name }));
            if (activeTabId && !tabs.some((t) => t.id === activeTabId)) {
              activeTabId = tabs.length > 0 ? tabs[0].id : null;
              saveTabsToStorage();
            }
          }
        } catch (err) {
          console.error("Failed to parse stored tabs:", err);
        }
      }

      if (e.key === `activeTab:${sessionId}` && e.newValue) {
        if (
          tabs.some((t) => t.id === e.newValue) &&
          activeTabId !== e.newValue
        ) {
          activeTabId = e.newValue;
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Cleanup
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      if (tabStateWs) {
        tabStateWs.close();
      }
      if (infoInterval) {
        clearInterval(infoInterval);
      }
      if (tabStateRetryTimeout) {
        clearTimeout(tabStateRetryTimeout);
      }
    };
  });
</script>

<div class="flex h-screen flex-col bg-black">
  <div
    class="flex items-center justify-between gap-4 border-b border-gray-800 bg-gray-900 p-2"
  >
    <div class="flex items-center gap-4">
      <div class="p-3">
        <img src="/logo.svg" alt="filepath logo" class="size-4" />
      </div>
      <Button
        onclick={copyShareUrl}
        title="Share this terminal session"
        variant="ghost"
        class="dark:text-white text-white hover:text-gray-400 hover:bg-transparent"
      >
        {#if copied}
          <Check class="w-4 h-4 text-green-400" />
        {:else}
          <Share2 class="w-4 h-4" />
        {/if}
      </Button>
    </div>

    <Button
      onclick={async () => {
        let c = await confirm("Are you sure you want to leave this session?");
        if (!c) return;
        goto("/");
      }}
      title="Home"
      variant="ghost"
      class="dark:text-white text-white hover:text-gray-400 hover:bg-transparent"
    >
      <X class="w-4 h-4" />
    </Button>
  </div>

  <div class="flex flex-1 flex-col bg-black">
    <!-- Tab Bar -->
    <div
      class="flex items-center gap-1 border-b border-gray-800 bg-gray-900 px-2"
    >
      {#each tabs as tab (tab.id)}
        <button
          onclick={() => switchTab(tab.id)}
          ondblclick={(e) => {
            e.stopPropagation();
            startEditingTab(tab.id, tab.name);
          }}
          class={cn(
            "group flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-xs transition-colors space-x-2",
            activeTabId === tab.id
              ? "border-blue-500 bg-gray-800 text-white"
              : "border-transparent text-gray-400 hover:bg-gray-800 hover:text-gray-300"
          )}
        >
          {#if editingTabId === tab.id}
            <input
              type="text"
              bind:value={editedTabName}
              onblur={() => saveTabName(tab.id)}
              onkeydown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveTabName(tab.id);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEditingTab();
                }
              }}
              onclick={(e) => e.stopPropagation()}
              class="font-mono bg-gray-700 text-white border border-blue-500 rounded px-1.5 py-0.5 text-xs min-w-[60px] max-w-[120px] focus:outline-none focus:ring-1 focus:ring-blue-500"
              use:autofocus
            />
          {:else}
            <span class="font-mono">{tab.name}</span>
          {/if}
          {#if tabs.length > 1 && editingTabId !== tab.id}
            <span
              role="button"
              tabindex="0"
              onclick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              class="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 cursor-pointer"
            >
              <X class="w-3 h-3" />
            </span>
          {/if}
        </button>
      {/each}
      <button
        onclick={() => createTab()}
        class="px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        title="New Tab"
      >
        <Plus class="w-4 h-4" />
      </button>
    </div>

    <!-- Terminal Container - now renders iframes -->
    <div class="flex-1 overflow-hidden p-4">
      {#each tabs as tab (tab.id)}
        <div
          class={cn(
            "h-full w-full",
            activeTabId === tab.id ? "block" : "hidden"
          )}
        >
          <div class="h-full">
            <iframe
              src={getIframeSrc(tab.id)}
              title="Terminal tab {tab.name}"
              class="h-full w-full border-0"
            ></iframe>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Password Prompt Modal -->
  {#if showPasswordPrompt}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
    >
      <div
        class="bg-gray-900 border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4"
      >
        <h2 class="text-xl font-bold mb-4 text-white">Password Required</h2>
        <p class="text-sm text-gray-400 mb-4">
          This session is protected with a password.
        </p>
        <input
          type="password"
          bind:value={passwordInput}
          placeholder="Enter password"
          onkeydown={(e) => {
            if (e.key === "Enter") {
              submitPassword();
            }
          }}
          class="w-full px-3 py-2 mb-4 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {#if passwordError}
          <p class="text-sm text-red-400 mb-4">{passwordError}</p>
        {/if}
        <div class="flex gap-2 justify-end">
          <button
            onclick={() => {
              showPasswordPrompt = false;
              passwordInput = "";
              passwordError = null;
            }}
            class="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onclick={submitPassword}
            disabled={!passwordInput.trim()}
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
