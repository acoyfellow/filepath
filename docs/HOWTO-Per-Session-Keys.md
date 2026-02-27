# How to Use Per-Session API Keys

A guide for overriding your account-level API key for specific sessions.

## When to use this

- **Different providers:** Use OpenAI for one session, Anthropic for another
- **Cost management:** Separate keys for personal vs work projects
- **Team collaboration:** Share a session with a team key
- **Testing:** Try new models without affecting account default

## How it works

filepath supports a 3-tier key resolution:

1. **Session key** (if set) ← Highest priority
2. **User account key** (your default)
3. **Global env key** (for e2e tests only)

If you set a per-session key, all agents in that session use it instead of your account key.

## Setting a session key

### During session creation

When you create a new session, there's an "API Key (optional)" field:

1. Click **New Session**
2. Fill in name and repo (optional)
3. Expand **Advanced Options**
4. Paste your API key
5. Click **Create**

### After session creation

1. Open the session
2. Click **Session Settings** (gear icon)
3. Go to **Provider API Key** tab
4. Toggle "Use different key for this session"
5. Paste the new key
6. Click **Save**

The change applies immediately to:
- Existing agents (next message they receive)
- New agents spawned in this session

### Removing a session key

1. Go to **Session Settings** → **Provider API Key**
2. Click **Remove Session Key**
3. Confirm

Agents will revert to using your account-level key.

## Encryption & Security

Session keys are:
- ✅ Encrypted with AES-GCM (same as account keys)
- ✅ Never logged or exposed in UI
- ✅ Only decrypted when spawning containers
- ✅ Isolated to that session only

Even filepath admins cannot see your keys.

## Use Cases

### Use Case 1: Different Models

Session A: OpenAI GPT-4 for analysis tasks
Session B: Claude for creative writing

### Use Case 2: Team Projects

- Personal account key: your individual work
- Session key: shared team key for group project
- Team members see same session, use same key

### Use Case 3: Client Work

- Account key: internal projects
- Session A key: Client A's OpenAI key
- Session B key: Client B's Anthropic key

### Use Case 4: Testing New Providers

Try a new provider (Groq, Together, etc.) without changing your default:
1. Create test session
2. Add new provider key
3. Spawn agent, test
4. Delete session or remove key when done

## Monitoring Usage

filepath tracks usage per-session:

1. Go to **Session Settings**
2. View **Usage Stats**
3. See: tokens used, API calls, estimated cost

This helps you understand which sessions are expensive.

## Troubleshooting

**"Invalid API key" error**
→ Check the key is valid with the provider directly

**"No API key configured for this session"**
→ Either add a session key or ensure account key is set

**Session key not being used**
→ Changes apply to NEW messages. Existing in-flight agents may still use old key.

**Rate limiting**
→ Session keys have their own rate limits. Check provider dashboard.

## Best Practices

1. **Use account key by default** - Simpler, applies everywhere
2. **Session keys for exceptions** - Different providers, team sharing
3. **Rotate regularly** - Both account and session keys
4. **Monitor costs** - Track which sessions are expensive
5. **Delete unused keys** - Remove session keys when session is deleted

## API Reference

Programmatically set session keys:

```bash
# Create session with specific key
POST /api/sessions
Body: {
  "name": "Team Project",
  "apiKey": "sk-xxx"  // Encrypted and stored
}

# Update session key
POST /api/sessions/[id]/api-key
Body: {
  "apiKey": "sk-yyy"  // null to remove
}
```

## See Also

- [Getting Started Tutorial](./TUTORIAL-Getting-Started.md)
- [API Reference](./API-REFERENCE.md)
