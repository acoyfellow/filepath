# Deja — Cross-Session Agent Memory

This project uses [deja](https://deja.coey.dev) for persistent memory across agent sessions.

## API Key

Set `DEJA_API_KEY` in your environment or `.env`:

```bash
export DEJA_API_KEY="deja-agent-memory-800105e7ee20e6c3c9c771a93c56f48d"
```

## Query Memories (start of session)

Pull relevant context before starting work:

```bash
curl -s -X POST https://deja.coey.dev/inject \
  -H "Authorization: Bearer $DEJA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"context": "myfilepath.com current sprint status", "format": "prompt", "limit": 7}'
```

Returns `{"prompt": "...", "learnings": [...]}`. The `prompt` field is ready to inject into an LLM context.

## Store Learnings (after milestones)

```bash
curl -s -X POST https://deja.coey.dev/learn \
  -H "Authorization: Bearer $DEJA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "trigger": "when to surface this",
    "learning": "what was learned",
    "confidence": 0.9
  }'
```

- `trigger` — semantic description of when this memory is relevant
- `learning` — the actual knowledge to recall
- `confidence` — 0.0–1.0 (entries below 0.3 get auto-cleaned)

## Current Memories (as of Feb 6, 2026)

7 learnings stored:

| Trigger | Summary |
|---------|--------|
| `working on myfilepath.com` | Current sprint: multi-agent orchestration, agent catalog, wizard, session view, conductor |
| `myfilepath architecture or deployment` | Stack, Alchemy not wrangler, bun not npm, dual interface pattern |
| `myfilepath what is working` | Build passes, auth, billing, containers, multi-agent schema+API+UI |
| `myfilepath what is next or in progress` | Container spin-up, agent execution, streaming, credit deduction |
| `myfilepath key files or where to find code` | File paths for all major components |
| `myfilepath footguns or common mistakes` | 8 footguns (bun, alchemy, svelte5, ttyd, etc.) |
| `myfilepath.com test account credentials login` | Test account + API key |

## API Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/inject` | POST | Optional* | Query memories by context |
| `/learn` | POST | Required | Store a new learning |
| `/query` | POST | Optional* | Raw vector search |

\* Auth required for non-anonymous scoped results.

## Tips

- Query at session start, store after completing features
- Use specific triggers — "myfilepath billing stripe" not "billing"
- Confidence 0.9+ for verified facts, 0.7 for educated guesses
- No individual delete API — stale memories decay via relevance ranking
- Memories are shared scope (visible to all sessions with the API key)
