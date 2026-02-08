<script lang="ts">
  import "$lib/styles/theme.css";
  import TopBar from "$lib/components/session/TopBar.svelte";
  import AgentTree from "$lib/components/session/AgentTree.svelte";
  import AgentPanel from "$lib/components/session/AgentPanel.svelte";
  import SpawnModal from "$lib/components/session/SpawnModal.svelte";
  import type { AgentNode, AgentType } from "$lib/types/session";
  import type { ChatMsg } from "$lib/components/session/ChatView.svelte";
  import type { AgentEvent } from "$lib/protocol";

  // ─── Theme ───
  let dark = $state(false);

  // ─── Spawn modal ───
  let showSpawn = $state(false);

  // ─── Demo data (mirrors React prototype) ───
  const uid = () => Math.random().toString(36).slice(2, 9);

  function mkNode(
    name: string,
    agentType: AgentType,
    model: string,
    status: "idle" | "thinking" | "running" | "done" | "error",
    children: AgentNode[] = [],
    opts: { tokens?: number } = {},
  ): AgentNode {
    return {
      id: uid(), name, agentType, model, status, children,
      sessionId: "demo", parentId: null, config: {},
      containerId: undefined, sortOrder: 0,
      tokens: opts.tokens ?? 0,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  }

  let rootNode = $state<AgentNode>(
    mkNode("conductor", "claude-code", "sonnet-4.5", "running", [
      mkNode("planner", "claude-code", "sonnet-4.5", "done", [
        mkNode("schema", "claude-code", "sonnet-4.5", "done", [], { tokens: 4218 }),
        mkNode("spec", "shelley", "sonnet-4.5", "done", [], { tokens: 3102 }),
      ], { tokens: 1200 }),
      mkNode("backend", "claude-code", "sonnet-4.5", "running", [
        mkNode("jwt", "claude-code", "sonnet-4.5", "done", [], { tokens: 5830 }),
        mkNode("passwords", "claude-code", "sonnet-4.5", "running", [], { tokens: 3400 }),
        mkNode("session-do", "claude-code", "sonnet-4.5", "thinking", [], { tokens: 1200 }),
        mkNode("routes", "shelley", "sonnet-4.5", "idle"),
      ], { tokens: 890 }),
      mkNode("frontend", "cursor", "sonnet-4.5", "idle", [
        mkNode("login-ui", "cursor", "sonnet-4.5", "idle"),
        mkNode("register-ui", "cursor", "sonnet-4.5", "idle"),
      ]),
      mkNode("e2e", "codex", "o3", "idle"),
    ], { tokens: 2400 }),
  );

  // ─── Demo chat messages per agent (by name) ───
  const demoChats: Record<string, ChatMsg[]> = {
    conductor: [
      { from: "u", event: { type: "text", content: "Build auth system for myfilepath.com" } },
      { from: "a", event: { type: "text", content: "Breaking this into workstreams. Starting with schema and API spec, then backend implementation." } },
      { from: "a", event: { type: "workers", workers: [
        { name: "planner", status: "done" },
        { name: "backend", status: "running" },
        { name: "frontend", status: "idle" },
        { name: "e2e", status: "idle" },
      ]}},
    ],
    planner: [
      { from: "u", event: { type: "text", content: "Break down the auth system into tasks" } },
      { from: "a", event: { type: "text", content: "Creating two agents: schema and API spec. Everything else depends on these." } },
      { from: "a", event: { type: "workers", workers: [
        { name: "schema", status: "done" },
        { name: "spec", status: "done" },
      ]}},
      { from: "a", event: { type: "text", content: "Both done. Schema: 2 tables, 3 indexes. Spec: 4 endpoints. Handing off to backend." } },
    ],
    schema: [
      { from: "a", event: { type: "text", content: "Starting on the DB schema. Need users table for auth and sessions for token refresh." } },
      { from: "a", event: { type: "tool", name: "write_file", path: "migrations/001_users.sql", status: "done", output: "CREATE TABLE users (\n  id TEXT PRIMARY KEY,\n  email TEXT UNIQUE NOT NULL,\n  password_hash TEXT NOT NULL,\n  created_at INTEGER DEFAULT (unixepoch()),\n  mfa_secret TEXT\n);" } },
      { from: "a", event: { type: "tool", name: "write_file", path: "migrations/002_sessions.sql", status: "done", output: "CREATE TABLE sessions (\n  id TEXT PRIMARY KEY,\n  user_id TEXT REFERENCES users(id),\n  token TEXT UNIQUE NOT NULL,\n  expires_at INTEGER NOT NULL,\n  ip TEXT\n);\n\nCREATE INDEX idx_sessions_token ON sessions(token);" } },
      { from: "a", event: { type: "text", content: "Schema's done. 2 tables, 3 indexes. Anything you want changed?" } },
      { from: "u", event: { type: "text", content: "add an `ip_address` column to sessions" } },
      { from: "a", event: { type: "text", content: "Done. Added `ip TEXT` to sessions. Migrations updated." } },
    ],
    spec: [
      { from: "a", event: { type: "tool", name: "write_file", path: "specs/auth.yaml", status: "done" } },
      { from: "a", event: { type: "text", content: "Spec complete. 4 endpoints: register, login, refresh, logout." } },
    ],
    backend: [
      { from: "a", event: { type: "workers", workers: [
        { name: "jwt", status: "done" },
        { name: "passwords", status: "running" },
        { name: "session-do", status: "thinking" },
        { name: "routes", status: "idle" },
      ]}},
      { from: "a", event: { type: "commit", hash: "a3f21b7", message: "feat: JWT sign/verify with Web Crypto" } },
      { from: "a", event: { type: "commit", hash: "b8c44e1", message: "test: 6 JWT tests" } },
      { from: "a", event: { type: "commit", hash: "c2d19f3", message: "wip: PBKDF2 password hashing" } },
      { from: "a", event: { type: "text", content: "JWT done and tested. Passwords in progress -- PBKDF2 at 100k iterations. Session DO being designed. Routes blocked until deps ready.\n\nWant me to keep going or steer something?" } },
    ],
    jwt: [
      { from: "a", event: { type: "text", content: "Implementing JWT with SubtleCrypto. No deps needed in Workers." } },
      { from: "a", event: { type: "tool", name: "write_file", path: "src/auth/jwt.ts", status: "done" } },
      { from: "a", event: { type: "command", cmd: "npx vitest run jwt.test.ts", status: "done", exit: 0, stdout: " PASS  (6 tests)\n \u2713 signs valid token\n \u2713 verifies valid token\n \u2713 rejects expired\n \u2713 rejects tampered\n \u2713 rejects malformed\n \u2713 empty payload" } },
      { from: "a", event: { type: "text", content: "All 6 passing. 0 deps, 142 lines." } },
    ],
    passwords: [
      { from: "a", event: { type: "text", content: "No argon2 in Workers. Using PBKDF2 via SubtleCrypto." } },
      { from: "a", event: { type: "command", cmd: "benchmarking", status: "done", exit: 0, stdout: "100k iterations: 42ms (fits 50ms CPU budget)" } },
      { from: "a", event: { type: "text", content: "100k iterations works. Writing verify function with constant-time compare now." } },
    ],
    "session-do": [
      { from: "a", event: { type: "text", content: "Each session = one DO instance. Alarm at `expires_at` for cleanup. Designing create > validate > refresh > revoke lifecycle." } },
    ],
  };

  // ─── State ───
  let selectedId = $state<string | null>(rootNode.id);

  /** Find a node by ID in the tree */
  function findNode(node: AgentNode, id: string): AgentNode | null {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
    return null;
  }

  /** Find a node by name in the tree */
  function findByName(node: AgentNode, name: string): AgentNode | null {
    if (node.name === name) return node;
    for (const child of node.children) {
      const found = findByName(child, name);
      if (found) return found;
    }
    return null;
  }

  let selectedAgent = $derived(
    selectedId ? findNode(rootNode, selectedId) : null,
  );

  let currentMessages = $derived(
    selectedAgent ? (demoChats[selectedAgent.name] ?? []) : [],
  );

  function handleSelect(id: string) {
    selectedId = id;
  }

  function handleNavigate(name: string) {
    const node = findByName(rootNode, name);
    if (node) selectedId = node.id;
  }

  function handleSend(message: string) {
    // TODO: Wire to WebSocket/DO
    console.log("Send:", message, "to:", selectedAgent?.name);
  }

  function handleSpawn(req: { name: string; agentType: AgentType; model: string }) {
    const parent = selectedAgent ?? rootNode;
    const newNode: AgentNode = {
      id: uid(),
      name: req.name,
      agentType: req.agentType,
      model: req.model,
      status: "idle",
      children: [],
      sessionId: "demo",
      parentId: parent.id,
      config: {},
      sortOrder: parent.children.length,
      tokens: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    parent.children = [...parent.children, newNode];
    showSpawn = false;
    selectedId = newNode.id;
  }
</script>

<div class:dark style="display:flex;flex-direction:column;height:100vh;width:100vw;background:var(--bg);color:var(--t1);overflow:hidden">
  <TopBar {dark} ontoggletheme={() => { dark = !dark; }} />

  <div style="display:flex;flex:1;overflow:hidden">
    <AgentTree
      root={rootNode}
      {selectedId}
      onselect={handleSelect}
      onspawn={() => { showSpawn = true; }}
    />

    <div style="flex:1;display:flex;flex-direction:column;background:var(--bg);overflow:hidden">
      <AgentPanel
        agent={selectedAgent}
        messages={currentMessages}
        onsend={handleSend}
        onnavigate={handleNavigate}
      />
    </div>
  </div>
</div>

{#if showSpawn}
  <SpawnModal
    onclose={() => { showSpawn = false; }}
    onspawn={handleSpawn}
  />
{/if}
