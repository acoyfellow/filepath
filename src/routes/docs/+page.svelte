<script lang="ts">
  import Nav from '$lib/components/Nav.svelte';
</script>

<svelte:head>
  <title>Docs - myfilepath.com</title>
</svelte:head>

<div class="min-h-screen bg-neutral-950 text-neutral-300 font-sans">
  <Nav variant="centered" />

  <main class="max-w-2xl mx-auto px-6 py-12">
    <h1 class="text-neutral-100 text-xl font-medium mb-8">Documentation</h1>

    <!-- Quick Start -->
    <section class="mb-12">
      <h2 class="text-neutral-100 text-lg mb-4">Quick Start</h2>
      <ol class="space-y-4 text-sm">
        <li>
          <span class="text-neutral-500">1.</span> Human creates account, loads credits
        </li>
        <li>
          <span class="text-neutral-500">2.</span> Human generates API key for agent
        </li>
        <li>
          <span class="text-neutral-500">3.</span> Agent calls orchestrator API:
          <div class="bg-neutral-900 border border-neutral-800 rounded p-4 mt-2 overflow-x-auto">
            <pre class="text-neutral-400 font-mono text-xs"><code>curl -X POST https://myfilepath.com/api/orchestrator \
  -H "x-api-key: fp_xxxx" \
  -H "Content-Type: application/json" \
  -d '{JSON.stringify({sessionId: "my-session", task: "echo hello"})}'</code></pre>
          </div>
        </li>
        <li>
          <span class="text-neutral-500">4.</span> Task executes in persistent container
        </li>
        <li>
          <span class="text-neutral-500">5.</span> Result returns, container persists
        </li>
      </ol>
    </section>

    <!-- Concepts -->
    <section class="mb-12">
      <h2 class="text-neutral-100 text-lg mb-4">Concepts</h2>
      
      <div class="space-y-6 text-sm">
        <div>
          <h3 class="text-neutral-100 mb-1">Sessions</h3>
          <p class="text-neutral-400">A session is a named container instance. Same sessionId = same container, same filesystem.</p>
        </div>
        
        <div>
          <h3 class="text-neutral-100 mb-1">Tasks</h3>
          <p class="text-neutral-400">A task is a command or script to execute. Runs in the session's container with full shell access.</p>
        </div>
        
        <div>
          <h3 class="text-neutral-100 mb-1">Handoff</h3>
          <p class="text-neutral-400">When approaching context limits, write state to <code class="bg-neutral-900 px-1 font-mono">.agent/handoff.md</code>, commit, exit. Next session continues.</p>
        </div>
        
        <div>
          <h3 class="text-neutral-100 mb-1">Health Checks</h3>
          <p class="text-neutral-400">Place <code class="bg-neutral-900 px-1 font-mono">gates/health.sh</code> in your repo. Runs between sessions. Exit 1 = blocker.</p>
        </div>
      </div>
    </section>

    <!-- API Reference -->
    <section class="mb-12">
      <h2 class="text-neutral-100 text-lg mb-4">API Reference</h2>
      
      <div class="space-y-6">
        <div>
          <h3 class="font-mono text-sm text-neutral-100 mb-2">POST /api/orchestrator</h3>
          <p class="text-neutral-400 text-sm mb-3">Execute a task in a session.</p>
          <div class="bg-neutral-900 border border-neutral-800 rounded p-4 overflow-x-auto">
            <pre class="text-neutral-400 font-mono text-xs"><code>// Request
{JSON.stringify({sessionId: "string", task: "string"}, null, 2)}

// Response
{JSON.stringify({success: true, result: "string"}, null, 2)}</code></pre>
          </div>
        </div>

        <div>
          <h3 class="font-mono text-sm text-neutral-100 mb-2">Headers</h3>
          <table class="w-full text-sm">
            <tbody>
              <tr class="border-b border-neutral-800">
                <td class="py-2 font-mono text-neutral-400">x-api-key</td>
                <td class="py-2 text-neutral-500">Required. Your API key.</td>
              </tr>
              <tr class="border-b border-neutral-800">
                <td class="py-2 font-mono text-neutral-400">Content-Type</td>
                <td class="py-2 text-neutral-500">application/json</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- Handoff Protocol -->
    <section class="mb-12">
      <h2 class="text-neutral-100 text-lg mb-4">Handoff Protocol</h2>
      <p class="text-neutral-400 text-sm mb-4">For multi-session tasks that exceed context limits:</p>
      <div class="bg-neutral-900 border border-neutral-800 rounded p-4 overflow-x-auto">
        <pre class="text-neutral-400 font-mono text-xs"><code># Before exiting:
1. git add -A && git commit -m "WIP: description"
2. Write state to .agent/handoff.md:
   - What was completed
   - What's next
   - Any blockers
3. Exit cleanly

# Next session:
1. Read .agent/handoff.md
2. Continue from documented state</code></pre>
      </div>
    </section>

  </main>

  <footer class="border-t border-neutral-800 px-6 py-6 text-center text-neutral-600 text-xs font-mono">
    myfilepath.com
  </footer>
</div>
