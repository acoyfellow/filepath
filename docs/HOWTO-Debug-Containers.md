# How to Debug Container Failures

A guide for troubleshooting when agents don't start or crash.

## Symptoms

- Agent appears in tree but shows "error" status
- Chat shows "Container spawn failed" message
- No output in chat panel
- Agent immediately goes to "idle" without working

## Quick Diagnostics

### 1. Check the Error Message

In the chat panel, look for red error messages:

```
❌ ERROR: Container spawn failed: [error details]
```

Common errors:
- `"No API key configured"` → Missing OpenRouter key
- `"Image not found"` → Container image issue
- `"Permission denied"` → Registry authentication
- `"Out of memory"` → Container exceeded 2GB RAM

### 2. Verify Your API Key

Go to **Settings** → **Provider API Keys**:

- Is a key saved? (should show masked: `sk-or-v1-a****xyz`)
- Is it valid? (test with provider directly)
- Does it have balance/credits?

### 3. Check Container Logs

filepath doesn't expose container logs directly yet. Workarounds:

**For Built-in Agents:**
These are maintained by filepath team. If they fail, it's likely:
- API key issue (most common)
- Transient Cloudflare Sandbox issue (retry)

**For Custom Agents:**
Test locally first:

```bash
# Pull and test your image locally
docker run --rm -it \
  -e FILEPATH_API_KEY="$YOUR_KEY" \
  -e FILEPATH_TASK="test" \
  your-image:tag

# Send test input
echo '{"type":"message","content":"test"}' | docker run -i \
  -e FILEPATH_API_KEY="$YOUR_KEY" \
  -e FILEPATH_TASK="test" \
  your-image:tag
```

## Common Issues

### Issue: "No API key configured"

**Cause:** User hasn't added OpenRouter/OpenAI key in Settings

**Fix:**
1. Go to Settings → Provider API Keys
2. Add your API key
3. Retry spawning agent

### Issue: Container spawns but no output

**Symptoms:**
- Status shows "running"
- Chat is empty
- No error message

**Causes:**
1. **Buffering** - Agent isn't flushing stdout
2. **Wrong format** - Not emitting NDJSON
3. **Crashed silently** - Agent died without emitting error

**Fix:**

Check your agent code:

```javascript
// BAD: Buffered output
console.log(JSON.stringify({type: 'text', content: 'hi'}));

// GOOD: Force flush
process.stdout.write(JSON.stringify({type: 'text', content: 'hi'}) + '\n');
```

### Issue: "Image not found"

**Cause:** Custom agent image doesn't exist or is private

**Fix:**
1. Verify image URL is correct
2. Make registry public or provide credentials
3. Check image was pushed successfully

### Issue: Agent dies after ~5 minutes

**Cause:** Idle timeout (expected behavior)

**Explanation:**
Cloudflare Sandbox containers sleep after 5 minutes of idle time to save resources. This is normal.

**Fix:**
Send a message to wake it up, or accept that long pauses will require re-warm.

### Issue: Out of Memory (OOM)

**Symptoms:**
- Agent dies during heavy operations
- Status goes to "error"
- Chat shows partial output then stops

**Cause:** Exceeded 2GB RAM limit

**Workarounds:**
- Process files in chunks, not all at once
- Use streaming operations instead of loading everything into memory
- Split work across multiple child agents

## Advanced Debugging

### Test with Direct Container API

If you have access to the container runtime directly:

```bash
# Using Cloudflare Sandbox CLI (if available)
wrangler sandbox exec \
  --image=filepath/shelley:latest \
  --env=FILEPATH_API_KEY=sk-xxx \
  --stdin=test-input.jsonl
```

### Enable Verbose Logging

Built-in agents support debug mode via environment:

```json
{
  "config": {
    "envVars": {
      "DEBUG": "1",
      "VERBOSE": "true"
    }
  }
}
```

Pass this in the spawn config.

### Check Network Access

Containers have limited network:
- ✅ Can reach OpenRouter API
- ✅ Can reach OpenAI API  
- ✅ Can reach most HTTPS endpoints
- ❌ Cannot access private networks
- ❌ Cannot access localhost

Test your agent's network requirements:

```javascript
// In your agent
try {
  const res = await fetch('https://api.openai.com/v1/models');
  console.log(JSON.stringify({type: 'text', content: `API reachable: ${res.status}`}));
} catch (e) {
  console.log(JSON.stringify({type: 'text', content: `Network error: ${e.message}`}));
}
```

### Validate Protocol

Your agent MUST:
1. Read stdin line-by-line
2. Parse each line as JSON
3. Emit valid NDJSON to stdout
4. Include newline after each JSON object

Test protocol compliance:

```bash
# Create test input
cat > test-input.ndjson << 'EOF'
{"type":"message","from":"user","content":"test"}
EOF

# Run agent and check output format
cat test-input.ndjson | docker run -i your-agent:latest 2>&1 | \
  while read line; do
    echo "Line: $line"
    echo "$line" | jq . 2>&1 && echo "✅ Valid JSON" || echo "❌ Invalid JSON"
  done
```

## Getting Help

If none of these steps resolve the issue:

1. **Check status page:** https://myfilepath.com/status
2. **Review logs:** Check browser DevTools → Network tab for WebSocket errors
3. **File issue:** https://github.com/acoyfellow/filepath/issues
   - Include: agent type, timestamp, error message
   - Redact: API keys, sensitive file paths

## Prevention

Best practices to avoid container failures:

1. **Test locally first** - Always verify custom agents locally
2. **Handle all errors** - Wrap code in try/catch, emit error events
3. **Validate input** - Don't assume stdin is valid JSON
4. **Emit status** - Keep users informed with status events
5. **Flush output** - Don't let Node.js/Python buffer stdout
6. **Set timeouts** - Don't let agents run forever
