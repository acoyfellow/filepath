# myfilepath.com

The platform for agents.

## Stack

- **SvelteKit** - Frontend framework
- **Better Auth** - Human authentication (email/password, OAuth)
- **Durable Objects** - Session state persistence
- **Cloudflare Containers** - Terminal sandboxes
- **D1** - Database for auth + metadata
- **Alchemy** - Infrastructure as code

## Development

```bash
bun install
bun run dev        # localhost:5173
```

## UI Components (shadcn-svelte)

We use [shadcn-svelte](https://shadcn-svelte.com/) for UI components.

```bash
# Add a new component
bunx shadcn-svelte@latest add [component-name] -y

# Examples:
bunx shadcn-svelte@latest add button -y
bunx shadcn-svelte@latest add card input label dialog -y
```

Components are installed to `src/lib/components/ui/`. Import like:

```svelte
<script>
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
</script>
```

## Deploy

```bash
# Production (myfilepath.com)
bun run deploy

# Preview
bun run deploy:preview
```

## Architecture

```
Human/Agent → SvelteKit → Durable Object (Session)
                              ↓
                        Container (Sandbox)
                           ttyd + opencode
```

- **Session DO**: Manages tabs, state, WebSocket broadcasts
- **Container**: Isolated terminal environment per tab
- **Better Auth**: Human identity (agents use API keys - coming soon)

## Checkpoint 1: Terminal Parity ✅

- [x] SvelteKit + better-auth base
- [x] Session management via Durable Objects
- [x] Terminal tabs UI
- [x] Container/sandbox integration
- [x] Terminal WebSocket proxy
- [x] Deploy to myfilepath.com
- [x] Tests/gates (`gates/terminal.gate.sh`)

## Footguns (Cloudflare Containers + ttyd)

These cost hours to debug. Don't repeat them.

### 1. ttyd requires initial size message

WebSocket connects but terminal shows nothing? ttyd waits for a size message before sending output.

```typescript
// After connecting to ttyd via sandbox.wsConnect:
await new Promise(r => setTimeout(r, 100));
ttydWs.send(JSON.stringify({ columns: 80, rows: 24 }));
```

### 2. Skip waitForPort in production

`sandbox.waitForPort()` is unreliable and times out. Let the WebSocket retry loop handle ttyd startup instead.

```typescript
// DON'T do this in prod:
await ttyd.waitForPort(7681, { mode: 'tcp', timeout: 60000 }); // Will timeout!

// DO: Just start the process and let WS retries handle it
const ttyd = await sandbox.startProcess('ttyd -W -p 7681 bash');
```

### 3. Worker needs compatibility flags for Containers

```typescript
// alchemy.run.ts
await Worker('worker', {
  compatibilityDate: "2025-11-15",
  compatibilityFlags: ["nodejs_compat"],
  observability: { enabled: true },  // For debugging
  // ...
});
```

### 4. SvelteKit cannot proxy WebSocket

Architecture must be:
- **HTTP** → SvelteKit → Worker (via server routes or service binding)
- **WebSocket** → Worker directly (api.myfilepath.com)

The terminal HTML page must connect WS to the API domain, not same origin.

### 5. Preserve request headers in wsConnect

```typescript
// Copy original request headers for ttyd handshake:
const wsHeaders = new Headers(request.headers);
if (!wsHeaders.get('Sec-WebSocket-Protocol')) {
  wsHeaders.set('Sec-WebSocket-Protocol', 'tty');
}
const wsRequest = new Request(wsUrl, { headers: wsHeaders, method: 'GET' });
```
