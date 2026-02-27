<script lang="ts">
</script>

<svelte:head>
  <title>How to Use Per-Session API Keys | filepath</title>
  <meta name="description" content="Override your account-level API key for specific sessions. Use different providers per project." />
</svelte:head>

<div class="min-h-screen font-sans bg-gray-50 text-gray-700 dark:bg-neutral-950 dark:text-neutral-300 transition-colors duration-200">
  <main class="max-w-3xl mx-auto px-6 py-12">
    <div class="mb-8">
      <a href="/docs" class="text-gray-500 dark:text-neutral-500 hover:text-neutral-300 text-sm">Back to Docs</a>
    </div>

    <h1 class="text-3xl font-medium text-gray-900 dark:text-neutral-100 mb-4">How to Use Per-Session API Keys</h1>
    <p class="text-gray-600 dark:text-neutral-400 mb-8">Override your account-level API key for specific sessions.</p>

    <div class="prose prose-invert prose-neutral max-w-none">
      <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mt-8 mb-4">When to Use This</h2>
      <ul class="space-y-2 text-gray-600 dark:text-neutral-400 mb-6">
        <li>• <strong>Different providers:</strong> Use OpenAI for one session, Anthropic for another</li>
        <li>• <strong>Cost management:</strong> Separate keys for personal vs work projects</li>
        <li>• <strong>Team collaboration:</strong> Share a session with a team key</li>
        <li>• <strong>Testing:</strong> Try new models without affecting account default</li>
      </ul>

      <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mt-8 mb-4">How It Works</h2>
      <p class="text-gray-600 dark:text-neutral-400 mb-4">filepath supports a 3-tier key resolution:</p>
      <ol class="list-decimal list-inside text-gray-600 dark:text-neutral-400 space-y-2 mb-6">
        <li><strong>Session key</strong> (if set) Highest priority</li>
        <li><strong>User account key</strong> (your default)</li>
        <li><strong>Global env key</strong> (for e2e tests only)</li>
      </ol>
      <p class="text-gray-600 dark:text-neutral-400 mb-6">If you set a per-session key, all agents in that session use it instead of your account key.</p>

      <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mt-8 mb-4">Setting a Session Key</h2>

      <h3 class="text-lg font-medium text-gray-700 dark:text-neutral-300 mt-6 mb-3">During Session Creation</h3>
      <ol class="list-decimal list-inside text-gray-600 dark:text-neutral-400 space-y-2 mb-6">
        <li>Click <strong>New Session</strong></li>
        <li>Fill in name and repo (optional)</li>
        <li>Expand <strong>Advanced Options</strong></li>
        <li>Paste your API key</li>
        <li>Click <strong>Create</strong></li>
      </ol>

      <h3 class="text-lg font-medium text-gray-700 dark:text-neutral-300 mt-6 mb-3">After Session Creation</h3>
      <ol class="list-decimal list-inside text-gray-600 dark:text-neutral-400 space-y-2 mb-6">
        <li>Open the session</li>
        <li>Click <strong>Session Settings</strong> (gear icon)</li>
        <li>Go to <strong>Provider API Key</strong> tab</li>
        <li>Toggle "Use different key for this session"</li>
        <li>Paste the new key</li>
        <li>Click <strong>Save</strong></li>
      </ol>

      <div class="bg-neutral-900/50 border border-gray-200 dark:border-neutral-800 rounded p-4 mb-6">
        <p class="text-gray-600 dark:text-neutral-400">The change applies immediately to:</p>
        <ul class="list-disc list-inside text-gray-600 dark:text-neutral-400 mt-2 space-y-1">
          <li>Existing agents (next message they receive)</li>
          <li>New agents spawned in this session</li>
        </ul>
      </div>

      <h3 class="text-lg font-medium text-gray-700 dark:text-neutral-300 mt-6 mb-3">Removing a Session Key</h3>
      <ol class="list-decimal list-inside text-gray-600 dark:text-neutral-400 space-y-2 mb-6">
        <li>Go to <strong>Session Settings / Provider API Key</strong></li>
        <li>Click <strong>Remove Session Key</strong></li>
        <li>Confirm</li>
      </ol>
      <p class="text-gray-600 dark:text-neutral-400">Agents will revert to using your account-level key.</p>

      <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mt-8 mb-4">Encryption & Security</h2>
      <p class="text-gray-600 dark:text-neutral-400 mb-4">Session keys are:</p>
      <ul class="space-y-2 text-gray-600 dark:text-neutral-400 mb-6">
        <li>Encrypted with AES-GCM (same as account keys)</li>
        <li>Never logged or exposed in UI</li>
        <li>Only decrypted when spawning containers</li>
        <li>Isolated to that session only</li>
      </ul>
      <p class="text-gray-600 dark:text-neutral-400">Even filepath admins cannot see your keys.</p>

      <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mt-8 mb-4">Use Cases</h2>

      <div class="space-y-4 mb-6">
        <div class="bg-neutral-900/50 border border-gray-200 dark:border-neutral-800 rounded p-4">
          <h3 class="font-medium text-gray-800 dark:text-neutral-200 mb-2">Different Models</h3>
          <p class="text-gray-600 dark:text-neutral-400">Session A: OpenAI GPT-4 for analysis tasks<br>Session B: Claude for creative writing</p>
        </div>

        <div class="bg-neutral-900/50 border border-gray-200 dark:border-neutral-800 rounded p-4">
          <h3 class="font-medium text-gray-800 dark:text-neutral-200 mb-2">Team Projects</h3>
          <p class="text-gray-600 dark:text-neutral-400">- Personal account key: your individual work<br>- Session key: shared team key for group project</p>
        </div>

        <div class="bg-neutral-900/50 border border-gray-200 dark:border-neutral-800 rounded p-4">
          <h3 class="font-medium text-gray-800 dark:text-neutral-200 mb-2">Client Work</h3>
          <p class="text-gray-600 dark:text-neutral-400">- Account key: internal projects<br>- Session A key: Client A's OpenAI key<br>- Session B key: Client B's Anthropic key</p>
        </div>
      </div>

      <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mt-8 mb-4">Monitoring Usage</h2>
      <p class="text-gray-600 dark:text-neutral-400 mb-4">filepath tracks usage per-session:</p>
      <ol class="list-decimal list-inside text-gray-600 dark:text-neutral-400 space-y-2 mb-6">
        <li>Go to <strong>Session Settings</strong></li>
        <li>View <strong>Usage Stats</strong></li>
        <li>See: tokens used, API calls, estimated cost</li>
      </ol>

      <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mt-8 mb-4">Troubleshooting</h2>

      <div class="space-y-4 mb-6">
        <div class="bg-red-900/20 border border-red-800/50 rounded p-4">
          <h3 class="font-medium text-red-200 mb-2">"Invalid API key" error</h3>
          <p class="text-red-300/80">Check the key is valid with the provider directly</p>
        </div>

        <div class="bg-red-900/20 border border-red-800/50 rounded p-4">
          <h3 class="font-medium text-red-200 mb-2">"No API key configured for this session"</h3>
          <p class="text-red-300/80">Either add a session key or ensure account key is set</p>
        </div>

        <div class="bg-yellow-900/20 border border-yellow-800/50 rounded p-4">
          <h3 class="font-medium text-yellow-200 mb-2">Session key not being used</h3>
          <p class="text-yellow-300/80">Changes apply to NEW messages. Existing in-flight agents may still use old key.</p>
        </div>
      </div>

      <h2 class="text-xl font-medium text-gray-800 dark:text-neutral-200 mt-8 mb-4">Best Practices</h2>
      <ul class="space-y-2 text-gray-600 dark:text-neutral-400 mb-6">
        <li>• <strong>Use account key by default</strong> — Simpler, applies everywhere</li>
        <li>• <strong>Session keys for exceptions</strong> — Different providers, team sharing</li>
        <li>• <strong>Rotate regularly</strong> — Both account and session keys</li>
        <li>• <strong>Monitor costs</strong> — Track which sessions are expensive</li>
        <li>• <strong>Delete unused keys</strong> — Remove session keys when session is deleted</li>
      </ul>
    </div>
  </main>
</div>
