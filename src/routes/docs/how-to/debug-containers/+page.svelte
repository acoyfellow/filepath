<script lang="ts">
  import { browser } from '$app/environment';
  import Nav from '$lib/components/Nav.svelte';
  import CodeBlock from '$lib/components/CodeBlock.svelte';

  let dark = $state(browser && document.documentElement.classList.contains('dark'));

  if (browser) {
    const observer = new MutationObserver(() => {
      dark = document.documentElement.classList.contains('dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
</script>

<svelte:head>
  <title>How to Debug Container Failures | filepath</title>
  <meta name="description" content="Troubleshoot when agents don't start or crash. Step-by-step debugging guide for filepath containers." />
</svelte:head>

<div class="min-h-screen font-sans {dark ? 'bg-neutral-950 text-neutral-300' : 'bg-gray-50 text-gray-700'} transition-colors duration-200">
  <Nav />

  <main class="max-w-3xl mx-auto px-6 py-12">
    <div class="mb-8">
      <a href="/docs" class="{dark ? 'text-neutral-500' : 'text-gray-500'} hover:text-neutral-300 text-sm">Back to Docs</a>
    </div>

    <h1 class="text-3xl font-medium {dark ? 'text-neutral-100' : 'text-gray-900'} mb-4">How to Debug Container Failures</h1>
    <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-8">Troubleshoot when agents don't start or crash unexpectedly.</p>

    <div class="prose prose-invert prose-neutral max-w-none">
      <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mt-8 mb-4">Common Symptoms</h2>
      <ul class="space-y-2 {dark ? 'text-neutral-400' : 'text-gray-600'} mb-6">
        <li>• Agent appears in tree but shows "error" status</li>
        <li>• Chat shows "Container spawn failed" message</li>
        <li>• No output in chat panel</li>
        <li>• Agent immediately goes to "idle" without working</li>
      </ul>

      <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mt-8 mb-4">Quick Diagnostics</h2>

      <h3 class="text-lg font-medium {dark ? 'text-neutral-300' : 'text-gray-700'} mt-6 mb-3">1. Check the Error Message</h3>
      <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-4">In the chat panel, look for red error messages:</p>
      <CodeBlock
        language="bash"
        className="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded p-4 text-sm {dark ? 'text-neutral-300' : 'text-gray-700'} overflow-x-auto mb-6"
        code={`ERROR: Container spawn failed: [error details]`}
      />
      <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-4">Common errors:</p>
      <ul class="space-y-2 {dark ? 'text-neutral-400' : 'text-gray-600'} mb-6">
        <li>• <code class="{dark ? 'bg-neutral-800' : 'bg-gray-100'} px-2 py-1 rounded">"No API key configured"</code>: Missing OpenRouter key</li>
        <li>• <code class="{dark ? 'bg-neutral-800' : 'bg-gray-100'} px-2 py-1 rounded">"Image not found"</code>: Container image issue</li>
        <li>• <code class="{dark ? 'bg-neutral-800' : 'bg-gray-100'} px-2 py-1 rounded">"Out of memory"</code>: Exceeded 2GB RAM</li>
      </ul>

      <h3 class="text-lg font-medium {dark ? 'text-neutral-300' : 'text-gray-700'} mt-6 mb-3">2. Verify Your API Key</h3>
      <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-4">Go to <strong>Settings / Provider API Keys</strong>:</p>
      <ul class="space-y-2 {dark ? 'text-neutral-400' : 'text-gray-600'} mb-6">
        <li>• Is a key saved? (should show masked: <code class="{dark ? 'bg-neutral-800' : 'bg-gray-100'} px-2 py-1 rounded">sk-or-v1-a****xyz</code>)</li>
        <li>• Is it valid? (test with provider directly)</li>
        <li>• Does it have balance/credits?</li>
      </ul>

      <h3 class="text-lg font-medium {dark ? 'text-neutral-300' : 'text-gray-700'} mt-6 mb-3">3. Test Your Container Locally</h3>
      <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-4">For custom agents, test locally first:</p>
      <CodeBlock
        language="bash"
        className="{dark ? 'bg-neutral-900' : 'bg-white'} border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded p-4 text-sm {dark ? 'text-neutral-300' : 'text-gray-700'} overflow-x-auto mb-6"
        code={`# Pull and test your image locally
docker run --rm -it \\
  -e FILEPATH_API_KEY="$YOUR_KEY" \\
  -e FILEPATH_TASK="test" \\
  your-image:tag

# Send test input
echo '{"type":"message","content":"test"}' | docker run -i \\
  -e FILEPATH_API_KEY="$YOUR_KEY" \\
  your-image:tag`}
      />

      <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mt-8 mb-4">Common Issues & Fixes</h2>

      <div class="space-y-6">
        <div class="bg-neutral-900/50 border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded p-4">
          <h3 class="font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mb-2">Issue: "No API key configured"</h3>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-2"><strong>Cause:</strong> User hasn't added OpenRouter/OpenAI key in Settings</p>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'}"><strong>Fix:</strong></p>
          <ol class="list-decimal list-inside {dark ? 'text-neutral-400' : 'text-gray-600'} mt-2 space-y-1">
            <li>Go to Settings / Provider API Keys</li>
            <li>Add your API key</li>
            <li>Retry spawning agent</li>
          </ol>
        </div>

        <div class="bg-neutral-900/50 border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded p-4">
          <h3 class="font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mb-2">Issue: Container spawns but no output</h3>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-2"><strong>Causes:</strong> Buffering, wrong format, or silent crash</p>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-2"><strong>Fix — Force stdout flush:</strong></p>
          <CodeBlock
            language="javascript"
            className="bg-neutral-950 border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded p-3 text-sm {dark ? 'text-neutral-300' : 'text-gray-700'} overflow-x-auto"
            code={`// BAD: Buffered output
console.log(JSON.stringify({}...));

// GOOD: Force flush
process.stdout.write(JSON.stringify({}...) + '\\n');`}
          />
        </div>

        <div class="bg-neutral-900/50 border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded p-4">
          <h3 class="font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mb-2">Issue: Agent dies after ~5 minutes</h3>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-2"><strong>Cause:</strong> Idle timeout (expected behavior)</p>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'}">Containers sleep after 5 minutes of idle time to save resources. Send a message to wake it up.</p>
        </div>

        <div class="bg-neutral-900/50 border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded p-4">
          <h3 class="font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mb-2">Issue: Out of Memory (OOM)</h3>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-2"><strong>Symptoms:</strong> Agent dies during heavy operations, partial output then stops</p>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-2"><strong>Cause:</strong> Exceeded 2GB RAM limit</p>
          <p class="{dark ? 'text-neutral-400' : 'text-gray-600'}"><strong>Workarounds:</strong></p>
          <ul class="list-disc list-inside {dark ? 'text-neutral-400' : 'text-gray-600'} mt-2 space-y-1">
            <li>Process files in chunks, not all at once</li>
            <li>Use streaming operations</li>
            <li>Split work across multiple child agents</li>
          </ul>
        </div>
      </div>

      <h2 class="text-xl font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mt-8 mb-4">Getting Help</h2>
      <p class="{dark ? 'text-neutral-400' : 'text-gray-600'} mb-4">If none of these steps resolve the issue:</p>
      <ol class="list-decimal list-inside {dark ? 'text-neutral-400' : 'text-gray-600'} space-y-2">
        <li>Check browser DevTools / Network tab for WebSocket errors</li>
        <li>File an issue on <a href="https://github.com/acoyfellow/filepath/issues" class="{dark ? 'text-neutral-300' : 'text-gray-700'} hover:underline">GitHub</a> with:
          <ul class="list-disc list-inside ml-4 mt-1 {dark ? 'text-neutral-500' : 'text-gray-500'}">
            <li>Agent type</li>
            <li>Timestamp</li>
            <li>Error message</li>
          </ul>
        </li>
      </ol>

      <div class="mt-8 p-4 bg-neutral-900/50 border {dark ? 'border-neutral-800' : 'border-gray-200'} rounded">
        <h3 class="text-lg font-medium {dark ? 'text-neutral-200' : 'text-gray-800'} mb-2">Prevention</h3>
        <ul class="space-y-2 {dark ? 'text-neutral-400' : 'text-gray-600'}">
          <li>• <strong>Test locally first</strong> — Always verify custom agents locally</li>
          <li>• <strong>Handle all errors</strong> — Wrap code in try/catch, emit error events</li>
          <li>• <strong>Validate input</strong> — Don't assume stdin is valid JSON</li>
          <li>• <strong>Emit status</strong> — Keep users informed with status events</li>
          <li>• <strong>Flush output</strong> — Don't let Node.js/Python buffer stdout</li>
        </ul>
      </div>
    </div>
  </main>
</div>
