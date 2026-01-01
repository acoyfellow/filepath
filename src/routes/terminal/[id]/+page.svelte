<script lang="ts">
  import { House, Share2, Check, X, Plus } from "@lucide/svelte";
  import { AGENTS } from "$lib/agents";
  import { cn } from "$lib/utils";
  import "@xterm/xterm/css/xterm.css";
  import { onMount, onDestroy } from "svelte";
  import { browser, dev } from "$app/environment";

  // Action to focus input when editing starts
  function autofocus(node: HTMLInputElement) {
    node.focus();
    node.select();
    return {};
  }
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import type { Terminal as TerminalType } from "@xterm/xterm";
  import type { FitAddon as FitAddonType } from "@xterm/addon-fit";

  // ttyd protocol commands
  const CMD_OUTPUT = "0";
  const CMD_SET_TITLE = "1";
  const CMD_SET_PREFS = "2";
  const CMD_RESIZE = "1";

  interface Tab {
    id: string;
    name: string;
    terminal: TerminalType | null;
    fitAddon: FitAddonType | null;
    ws: WebSocket | null;
    container: HTMLDivElement | null;
    connected: boolean;
    error: string | null;
    tmuxWindowIndex?: number;
  }

  let tabs = $state<Tab[]>([]);
  let activeTabId = $state<string | null>(null);
  let editingTabId = $state<string | null>(null);
  let editedTabName = $state<string>("");
  let copied = $state(false);
  let textEncoder = new TextEncoder();
  let textDecoder = new TextDecoder();
  let recvDebug = 0;
  const startedSessions = new Set<string>();
  let tabStateWs: WebSocket | null = null;

  const sessionId = $derived(page.params.id);

  // Load agents from SessionStateDO (persistent) or fallback to URL params (backward compatibility)
  let selectedAgents = $state<string[]>([]);
  let sessionCreatedAt = $state<number | null>(null);
  let sessionLastActivity = $state<number | null>(null);
  let sessionTtl = $state<number>(10 * 60 * 1000); // Default 10 minutes
  let sessionAge = $state<number>(0);
  let sessionTimeUntilSleep = $state<number>(10 * 60 * 1000);
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
      const res = await fetch(`/api/session/${sessionId}/info`, { headers });
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
          agents: string[];
          hasPassword?: boolean;
        };
        sessionHasPassword = info.hasPassword || false;
        // Store server values for calculation
        if (info.createdAt && !sessionCreatedAt) {
          sessionCreatedAt = info.createdAt;
        }
        if (info.lastActivity) {
          sessionLastActivity = info.lastActivity;
        } else if (info.createdAt && !sessionLastActivity) {
          sessionLastActivity = info.createdAt;
        }
        if (info.ttl) {
          sessionTtl = info.ttl;
        }
        if (info.agents && info.agents.length > 0) {
          selectedAgents = info.agents;
        }
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
    const res = await fetch(`/api/session/${sessionId}/info`, { headers });

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

  // Calculate age and time until sleep in real-time
  // Use lastActivity for countdown (TTL is idle timeout, resets on activity)
  $effect(() => {
    if (!browser || !sessionCreatedAt || !sessionLastActivity) return;

    const updateTimes = () => {
      const now = Date.now();
      const ttl = sessionTtl; // Capture current value
      sessionAge = now - sessionCreatedAt!;
      // Calculate based on last activity, not creation time
      const timeSinceActivity = now - sessionLastActivity!;
      sessionTimeUntilSleep = Math.max(0, ttl - timeSinceActivity);
    };

    // Update immediately
    updateTimes();

    // Update every second for smooth countdown
    const interval = setInterval(updateTimes, 1000);

    return () => clearInterval(interval);
  });

  const activeAgents = $derived(
    selectedAgents
      .map((id) => AGENTS[id as keyof typeof AGENTS])
      .filter(Boolean)
  );

  // Format time for display
  function formatTime(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  const activeTab = $derived(tabs.find((t) => t.id === activeTabId) || null);

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
      const res = await fetch(`/api/session/${sessionId}/tabs`, {
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
      const res = await fetch(`/api/session/${sessionId}/tabs`, { headers });
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

  // Restore tabs from storage (without terminal instances)
  async function restoreTabs() {
    if (!browser || !sessionId) return;
    const storedTabs = await loadTabsFromStorage();
    if (storedTabs.length > 0) {
      tabs = storedTabs.map((stored) => ({
        id: stored.id,
        name: stored.name,
        terminal: null,
        fitAddon: null,
        ws: null,
        container: null,
        connected: false,
        error: null,
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
      terminal: null,
      fitAddon: null,
      ws: null,
      container: null,
      connected: false,
      error: null,
    };
    tabs = [...tabs, tab];
    activeTabId = tabId;
    await saveTabsToStorage();
    return tabId;
  }

  async function closeTab(tabId: string) {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) {
      if (tab.ws) tab.ws.close();
      if (tab.terminal) tab.terminal.dispose();
    }
    tabs = tabs.filter((t) => t.id !== tabId);
    if (activeTabId === tabId) {
      activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
    }
    await saveTabsToStorage();
  }

  async function switchTab(tabId: string) {
    activeTabId = tabId;
    // Each tab has its own independent WebSocket connection - no coordination needed
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

  async function initializeTab(tab: Tab) {
    if (!browser || !sessionId || !tab.container) return;

    try {
      // Dynamic import for browser-only xterm
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      tab.terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: "monospace",
        theme: {
          background: "#000000",
          foreground: "#ffffff",
          cursor: "#ffffff",
        },
      }) as TerminalType;

      tab.fitAddon = new FitAddon() as FitAddonType;
      tab.terminal?.loadAddon(tab.fitAddon);

      if (!tab.terminal || !tab.container || !tab.fitAddon) {
        console.error("Terminal not initialized");
        return;
      }

      tab.terminal.open(tab.container);
      tab.fitAddon.fit();

      // Show loading screen with agents
      const agentNames = activeAgents.map((a) => a.name).join(", ");
      tab.terminal.write("\x1b[2J\x1b[H"); // Clear screen
      tab.terminal.writeln("\r\n");

      // Agent logos (simple spinner + text)
      const agents = activeAgents.slice(0, 3); // Show first 3
      const agentEmojis = agents
        .map((a) => {
          switch (a.id) {
            case "claude":
              return "🤖";
            case "codex":
              return "⚡";
            case "cursor":
              return "💻";
            case "opencode":
              return "🔓";
            case "droid":
              return "🤖";
            default:
              return "•";
          }
        })
        .join(" ");

      tab.terminal.writeln(`  ${agentEmojis}\r\n`);
      tab.terminal.writeln(`  Loading environment with ${agentNames}...\r\n`);
      tab.terminal.writeln("\r\n");

      // Ensure main session is initialized first (agents installed, env vars set)
      if (!startedSessions.has(sessionId)) {
        const headers = {
          "Content-Type": "application/json",
          ...getPasswordHeader(),
        };
        const mainStartRes = await fetch(`/api/terminal/${sessionId}/start`, {
          method: "POST",
          headers,
          body: JSON.stringify({ agents: selectedAgents }),
        });
        if (mainStartRes.status === 401) {
          sessionStorage.removeItem(`session:${sessionId}:password`);
          showPasswordPrompt = true;
          throw new Error("Password required");
        }
        const mainStartData = (await mainStartRes.json()) as {
          ready?: boolean;
          error?: string;
        };
        if (!mainStartRes.ok || !mainStartData.ready) {
          throw new Error(
            mainStartData.error || "Failed to initialize session"
          );
        }
        startedSessions.add(sessionId);
      }

      // Start the terminal session for this specific tab
      // Each tab gets its own independent terminal session
      const headers = {
        "Content-Type": "application/json",
        ...getPasswordHeader(),
      };
      const startRes = await fetch(
        `/api/terminal/${sessionId}/${tab.id}/start`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ agents: selectedAgents }),
        }
      );
      if (startRes.status === 401) {
        sessionStorage.removeItem(`session:${sessionId}:password`);
        showPasswordPrompt = true;
        throw new Error("Password required");
      }
      const startData = (await startRes.json()) as {
        ready?: boolean;
        error?: string;
        port?: number;
        windowIndex?: number;
      };

      if (!startRes.ok || !startData.ready) {
        throw new Error(startData.error || "Failed to start terminal");
      }

      // Store the tmux window index for this tab
      if (startData.windowIndex !== undefined) {
        tab.tmuxWindowIndex = startData.windowIndex;
      }

      // WebSocket URL - each tab uses its own tab-specific endpoint
      let wsUrl: string;
      const password = sessionStorage.getItem(`session:${sessionId}:password`);
      const passwordParam = password
        ? `?password=${encodeURIComponent(password)}`
        : "";
      if (dev) {
        wsUrl = `ws://localhost:1337/terminal/${sessionId}/${tab.id}/ws${passwordParam}`;
      } else {
        wsUrl = `wss://${window.location.host}/api/terminal/${sessionId}/${tab.id}/ws${passwordParam}`;
      }

      console.log("wsUrl", wsUrl);

      // ttyd requires 'tty' subprotocol
      tab.ws = new WebSocket(wsUrl, ["tty"]) as unknown as WebSocket;
      tab.ws.binaryType = "arraybuffer";

      tab.ws.onopen = () => {
        if (!tab.terminal || !tab.ws) return;
        tab.connected = true;

        // Clear terminal before tmux sends its buffer
        // This ensures we get a clean slate with tmux's actual screen state
        tab.terminal.clear();

        // ttyd handshake - send terminal size, then tmux will send its screen buffer
        tab.ws!.send(
          textEncoder.encode(
            JSON.stringify({
              columns: tab.terminal!.cols,
              rows: tab.terminal!.rows,
            })
          )
        );

        // Note: Each WebSocket connection to ttyd is already independent
        // No need for tmux multiplexing - ttyd handles it automatically

        // ttyd input framing - send keystrokes to the shared tmux session
        // All connected browsers receive output directly from ttyd (no broadcast needed)
        tab.terminal!.onData((data) => {
          if (!tab.ws || tab.ws.readyState !== WebSocket.OPEN) return;
          const payload = new Uint8Array(data.length * 3 + 1);
          payload[0] = "0".charCodeAt(0);
          const stats = textEncoder.encodeInto(data, payload.subarray(1));
          tab.ws!.send(payload.subarray(0, (stats.written as number) + 1));
        });

        // Focus terminal after window selection completes
        setTimeout(() => {
          if (tab.terminal && activeTabId === tab.id) {
            tab.terminal.focus();
          }
        }, 600);
      };

      tab.ws.onmessage = (e) => {
        if (!tab.terminal) return;
        if (dev && recvDebug < 5) {
          console.log("[ttyd] onmessage typeof:", typeof e.data);
        }

        if (typeof e.data === "string") {
          if (dev && recvDebug < 5) console.log("[ttyd] string frame:", e.data);
          recvDebug++;
          return;
        }

        const handle = (raw: ArrayBuffer) => {
          const u8 = new Uint8Array(raw);
          const cmd = String.fromCharCode(u8[0]);
          const data = raw.slice(1);

          if (dev && recvDebug < 5)
            console.log("[ttyd] frame", cmd, "len", u8.byteLength);
          recvDebug++;

          switch (cmd) {
            case CMD_OUTPUT:
              // Write output to terminal - all browsers connected to same tmux session
              // receive this directly from ttyd, no broadcast needed
              (tab.terminal as any).write(new Uint8Array(data));
              break;
            case CMD_SET_TITLE:
              const title = textDecoder.decode(data);
              document.title = title;
              // Update tab name from title if it's just a number (default name)
              // But ignore generic titles like "tmux", "bash", "sh", etc.
              if (/^\d+$/.test(tab.name)) {
                const genericTitles = [
                  "tmux",
                  "bash",
                  "sh",
                  "zsh",
                  "fish",
                  "cmd",
                  "powershell",
                ];
                const firstWord = title.split(" ")[0]?.toLowerCase() || "";
                if (!genericTitles.includes(firstWord)) {
                  // Extract a short name from title (first word or first 8 chars)
                  const shortName =
                    title.split(" ")[0]?.slice(0, 8) || tab.name;
                  tab.name = shortName;
                  tabs = [...tabs]; // Trigger reactivity
                  saveTabsToStorage();
                }
              }
              break;
            case CMD_SET_PREFS:
              // ignore
              break;
          }
        };

        if (e.data instanceof ArrayBuffer) return handle(e.data);
        if (e.data instanceof Blob) {
          e.data.arrayBuffer().then(handle);
        }
      };

      tab.ws.onerror = (err) => {
        console.error(`Tab ${tab.id} WebSocket error:`, err);
        // Don't set error immediately - allow retry
        // Only set error if we've tried multiple times
        if (!tab.error) {
          tab.error = "Connection error - retrying...";
          tab.terminal?.writeln(
            `\x1b[33mConnection error, retrying...\x1b[0m\r\n`
          );
        }
      };

      tab.ws.onclose = (event) => {
        tab.connected = false;
        // If closed unexpectedly (not a clean close), try to reconnect after a delay
        if (event.code !== 1000 && !tab.error) {
          console.log(
            `Tab ${tab.id} WebSocket closed unexpectedly, code: ${event.code}`
          );
          // Don't auto-reconnect - let the user see the error or manually retry
          if (tab.terminal) {
            tab.terminal.writeln("\r\n\x1b[33mConnection closed\x1b[0m\r\n");
          }
        } else if (!tab.error && tab.terminal) {
          tab.terminal.writeln("\r\n\x1b[33mConnection closed\x1b[0m\r\n");
        }
      };

      // Handle window resize
      const handleResize = () => {
        if (!tab.fitAddon || !tab.terminal || !tab.ws) return;
        tab.fitAddon.fit();
        const { cols, rows } = tab.terminal;
        if (tab.ws.readyState === WebSocket.OPEN) {
          tab.ws.send(
            textEncoder.encode(
              CMD_RESIZE + JSON.stringify({ columns: cols, rows })
            )
          );
        }
      };
      window.addEventListener("resize", handleResize);
    } catch (err) {
      tab.error =
        err instanceof Error ? err.message : "Failed to initialize terminal";
      console.error("Terminal initialization error:", err);
    }
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
    // Refresh session info every 30 seconds to sync with server (age calculated locally)
    infoInterval = setInterval(loadSessionInfo, 30000);

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
        wsUrl = `wss://${window.location.host}/api/session/${sessionId}/tabs/ws${passwordParam}`;
      }

      tabStateWs = new WebSocket(wsUrl);

      tabStateWs.onopen = () => {
        console.log("Tab state WebSocket connected");
      };

      tabStateWs.onmessage = (e) => {
        try {
          const message = JSON.parse(e.data);

          // Handle tab state updates (terminal sync happens via shared tmux session)
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
              const existingTabs = new Map(tabs.map((t) => [t.id, t]));
              tabs = data.tabs.map((stored) => {
                const existing = existingTabs.get(stored.id);
                if (existing) {
                  return { ...existing, name: stored.name };
                }
                return {
                  id: stored.id,
                  name: stored.name,
                  terminal: null,
                  fitAddon: null,
                  ws: null,
                  container: null,
                  connected: false,
                  error: null,
                };
              });
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
        // Try to reconnect on error
        setTimeout(connectTabStateSync, 1000);
      };

      tabStateWs.onclose = (event) => {
        console.log("Tab state WebSocket closed", event.code, event.reason);
        // Always reconnect (tab state sync is critical)
        setTimeout(connectTabStateSync, 1000);
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

          // Create a map of existing tabs by ID to preserve terminal instances
          const existingTabs = new Map(tabs.map((t) => [t.id, t]));

          // Update tabs: merge stored data with existing terminal instances
          const updatedTabs = storedTabs.map((stored) => {
            const existing = existingTabs.get(stored.id);
            if (existing) {
              // Create new object to trigger reactivity if name changed
              if (existing.name !== stored.name) {
                return {
                  ...existing,
                  name: stored.name,
                };
              }
              return existing;
            }
            // New tab - create without terminal instance
            return {
              id: stored.id,
              name: stored.name,
              terminal: null,
              fitAddon: null,
              ws: null,
              container: null,
              connected: false,
              error: null,
            };
          });

          // Always update to match storage (preserve order from storage)
          // Storage is the source of truth for tab state across windows
          const currentTabIds = tabs.map((t) => t.id).join(",");
          const newTabIds = updatedTabs.map((t) => t.id).join(",");
          const currentNames = tabs.map((t) => `${t.id}:${t.name}`).join(",");
          const newNames = updatedTabs
            .map((t) => `${t.id}:${t.name}`)
            .join(",");

          // Update if anything changed (order, IDs, or names)
          if (currentTabIds !== newTabIds || currentNames !== newNames) {
            // Preserve exact order from storage - this is the source of truth
            tabs = [...updatedTabs];
            // If active tab was removed, switch to first tab
            if (activeTabId && !tabs.some((t) => t.id === activeTabId)) {
              activeTabId = tabs.length > 0 ? tabs[0].id : null;
              saveTabsToStorage(); // Save the new active tab
            }
          }
        } catch (err) {
          console.error("Failed to parse stored tabs:", err);
        }
      }

      if (e.key === `activeTab:${sessionId}` && e.newValue) {
        // Only update if it's a valid tab ID
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
    };
  });

  // Initialize only the active tab when container is available
  // This prevents creating multiple WebSocket connections on refresh
  $effect(() => {
    if (!browser) return;
    const tab = activeTab;
    // Only initialize the currently active tab, and only if it's not already initialized
    if (
      tab &&
      tab.container &&
      !tab.terminal &&
      !tab.ws &&
      activeTabId === tab.id
    ) {
      initializeTab(tab);
    }
  });

  // Focus terminal when switching tabs
  $effect(() => {
    if (!browser) return;
    const tab = activeTab;
    if (tab && tab.terminal) {
      // Small delay to ensure DOM is updated and terminal is visible
      setTimeout(() => {
        if (tab.terminal && activeTabId === tab.id) {
          tab.terminal.focus();
        }
      }, 50);
    }
  });

  onDestroy(() => {
    if (!browser) return;
    tabs.forEach((tab) => {
      if (tab.ws) tab.ws.close();
      if (tab.terminal) tab.terminal.dispose();
    });
  });
</script>

<div class="flex h-screen flex-col bg-black">
  <div
    class="flex items-center justify-between gap-4 border-b border-gray-800 bg-gray-900 p-2"
  >
    <div class="flex items-center gap-4">
      <a
        href="/"
        class="rounded px-3 py-1 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        title="Home"
      >
        <House class="w-4 h-4" />
      </a>
      <span class="font-mono text-sm text-gray-400">Session: {sessionId}</span>
      {#if activeAgents.length > 0}
        <div class="flex -space-x-2">
          {#each activeAgents as agent}
            <a
              href={agent.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="relative inline-block rounded-full ring-2 ring-gray-900 hover:ring-gray-700 transition-all hover:scale-110"
              title={`${agent.name} - ${agent.command}`}
            >
              <img
                src={agent.logoUrl}
                alt={`${agent.name} logo`}
                class={cn(
                  "h-8 w-8 rounded-full object-cover bg-gray-800 p-1.5",
                  agent.id === "codex" && "invert"
                )}
              />
            </a>
          {/each}
        </div>
      {/if}
    </div>
    <button
      onclick={copyShareUrl}
      class="flex items-center gap-2 rounded px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
      title="Share this terminal session"
    >
      {#if copied}
        <Check class="w-4 h-4 text-green-400" />
        <span class="text-green-400">Copied!</span>
      {:else}
        <Share2 class="w-4 h-4" />
        <span>Share Session</span>
      {/if}
    </button>
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
        class="rounded-t-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        title="New Tab"
      >
        <Plus class="w-4 h-4" />
      </button>
    </div>

    <!-- Terminal Container -->
    <div class="flex-1 overflow-hidden p-4">
      {#each tabs as tab (tab.id)}
        <div
          class={cn(
            "h-full w-full",
            activeTabId === tab.id ? "block" : "hidden"
          )}
        >
          {#if tab.error}
            <div class="flex h-full items-center justify-center">
              <div class="text-center">
                <p class="mb-4 text-red-400">{tab.error}</p>
              </div>
            </div>
          {:else}
            <div
              class="h-full rounded-lg overflow-hidden ring ring-gray-800 p-2"
            >
              <div bind:this={tab.container} class="h-full w-full"></div>
            </div>
          {/if}
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

<style>
  :global(.xterm) {
    height: 100%;
  }
</style>
