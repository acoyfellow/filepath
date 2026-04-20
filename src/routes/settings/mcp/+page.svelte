<script lang="ts">
  import SEO from "$lib/components/SEO.svelte";
  import MCPConnectionsPanel from "$lib/components/workspace/MCPConnectionsPanel.svelte";
  import type { PageData } from "./$types";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
</script>

<SEO
  title="MCP | filepath"
  description="Connect OAuth-gated MCP servers for your filepath agents."
  keywords="filepath mcp model context protocol"
  path="/settings/mcp"
  type="website"
  section="Settings"
  tags="settings,mcp"
  noindex
  breadcrumbs={[
    { name: "Dashboard", item: "/dashboard" },
    { name: "MCP", item: "/settings/mcp" },
  ]}
/>

<div
  class="min-h-screen bg-gray-50 font-sans text-gray-700 transition-colors duration-200 dark:bg-neutral-950 dark:text-neutral-300"
>
  <main class="mx-auto max-w-3xl px-6 py-12">
    <div class="mb-10 flex items-center justify-between">
      <div>
        <h1 class="mb-1 text-xl font-medium text-gray-900 dark:text-neutral-100">
          MCP servers
        </h1>
        <p class="text-sm text-gray-500 dark:text-neutral-500">
          Connect external MCP servers so agents in your workspaces can use them.
        </p>
      </div>
      <div class="flex gap-3">
        <a
          href="/dashboard"
          class="rounded border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-400 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-600"
          >Back</a
        >
      </div>
    </div>

    <div
      class="mb-6 rounded border border-gray-200 bg-gray-100 p-4 transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <p class="text-sm text-gray-600 dark:text-neutral-400">
        MCP (Model Context Protocol) lets your agents call tools on external
        servers. Connections are scoped to your account and shared across
        workspaces. To let an agent use MCP tools, also toggle the <strong>MCP</strong>
        permission in the agent's settings.
      </p>
    </div>

    <MCPConnectionsPanel userId={data.userId} workerBaseUrl={data.workerBaseUrl} />

    <div class="mt-6 text-xs text-gray-500 dark:text-neutral-500">
      <p>
        Currently supports <code>cf-portal</code> (portal.mcp.cfdata.org). More
        servers coming as the integration stabilises.
      </p>
    </div>
  </main>
</div>
