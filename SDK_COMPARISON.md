# filepath SDK vs Raw REST API

## Quick Comparison

| Operation | SDK (Library Way) | Raw REST (Manual Way) |
|-----------|-------------------|----------------------|
| **List Sessions** | `client.sessions.list()` | `fetch('/api/sessions').then(r => r.json())` |
| **Create Session** | `client.sessions.create("My Project")` | `fetch('/api/sessions', {method: 'POST', ...})` |
| **Spawn Agent** | `client.nodes.spawn(sessionId, {...})` | `fetch('/api/sessions/${id}/nodes', {method: 'POST', ...})` |
| **Send Message** | `chat.send("Hello!")` | `ws.send(JSON.stringify({type: 'message', content: 'Hello!'}))` |

---

## Example: Create Session + Spawn Agent + Chat

### SDK Way (Clean, Type-Safe)

```typescript
import { FilepathClient, quickstart } from '@filepath/sdk';

// Option 1: Step by step
const client = new FilepathClient('https://myfilepath.com');

// Create session
const session = await client.sessions.create('API Research Project');
console.log('Session:', session.id);

// Spawn Pi agent
const node = await client.nodes.spawn(session.id, {
  name: 'Researcher',
  agentType: 'pi',
  model: 'anthropic/claude-sonnet-4'
});
console.log('Agent:', node.id);

// Connect to chat
const chat = client.chat.connect(node.id, {
  onMessage: (msg) => {
    if (msg.role === 'agent') {
      console.log('Agent:', msg.content);
    }
  },
  onStateChange: (state) => console.log('Connection:', state)
});

// Send task
chat.send('Research the Stripe API and summarize the key endpoints');

// Later: Get all nodes in tree
const tree = await client.sessions.tree(session.id);
console.log('Active agents:', tree.length);

// Cleanup
chat.close();
```

### Raw REST Way (Verbose, Manual)

```typescript
const BASE_URL = 'https://myfilepath.com';

// 1. Create session
const sessionRes = await fetch(`${BASE_URL}/api/sessions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // for cookies
  body: JSON.stringify({ name: 'API Research Project' })
});
const session = await sessionRes.json();
console.log('Session:', session.id);

// 2. Spawn agent
const nodeRes = await fetch(`${BASE_URL}/api/sessions/${session.id}/nodes`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    name: 'Researcher',
    agentType: 'pi',
    model: 'anthropic/claude-sonnet-4'
  })
});
const node = await nodeRes.json();
console.log('Agent:', node.id);

// 3. Connect WebSocket (manual protocol handling)
const wsUrl = BASE_URL.replace('http', 'ws');
const ws = new WebSocket(`${wsUrl}/agents/chat-agent/${node.id}`);

ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.role === 'agent') {
    console.log('Agent:', msg.content);
  }
};
ws.onclose = () => console.log('Disconnected');
ws.onerror = (err) => console.error('Error:', err);

// 4. Send message (correct protocol format)
ws.send(JSON.stringify({
  type: 'message',
  content: 'Research the Stripe API and summarize the key endpoints'
}));

// 5. Get tree (separate API call)
const treeRes = await fetch(`${BASE_URL}/api/sessions/${session.id}/tree`, {
  credentials: 'include'
});
const treeData = await treeRes.json();
console.log('Active agents:', treeData.tree.length);

// Cleanup
ws.close();
```

---

## Auto-Generated from OpenAPI

The TypeScript types can be auto-generated from `/api/openapi.json`:

```bash
# Using openapi-typescript
npx openapi-typescript https://myfilepath.com/api/openapi.json -o filepath-api.d.ts

# Now you get types like:
# paths['/api/sessions']['get']['responses']['200']['content']['application/json']
```

---

## Why an SDK?

1. **Type Safety**: Catch errors at compile time
2. **Less Boilerplate**: ~70% less code
3. **Best Practices**: Auto-retry, error handling, connection management
4. **Discoverability**: IDE autocomplete shows all available methods
5. **Protocol Handling**: WebSocket message format is abstracted

---

## How to Auto-Generate

From your existing OpenAPI spec (`/api/openapi.json`), you can generate:

1. **Types** → `openapi-typescript`
2. **Client** → `openapi-generator-cli` with typescript-fetch template
3. **Documentation** → Swagger UI or Scalar (already have this!)

The SDK in `sdk-example.ts` is hand-written for clarity, but could be 80% auto-generated from your OpenAPI spec.
