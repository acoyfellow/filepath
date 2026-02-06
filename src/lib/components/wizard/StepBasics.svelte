<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';

  interface Props {
    name: string;
    description: string;
    gitRepoUrl: string;
    onUpdate: (field: 'name' | 'description' | 'gitRepoUrl', value: string) => void;
  }

  let { name, description, gitRepoUrl, onUpdate }: Props = $props();
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-xl font-semibold text-white mb-1">Session Basics</h2>
    <p class="text-sm text-neutral-400">Name your session and optionally link a repository.</p>
  </div>

  <div class="space-y-4">
    <div class="space-y-2">
      <Label for="session-name" class="text-neutral-300">Session Name *</Label>
      <Input
        id="session-name"
        value={name}
        oninput={(e: Event) => onUpdate('name', (e.target as HTMLInputElement).value)}
        placeholder="My Awesome Project"
        class="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500"
      />
    </div>

    <div class="space-y-2">
      <Label for="session-desc" class="text-neutral-300">Description</Label>
      <Textarea
        id="session-desc"
        value={description}
        oninput={(e: Event) => onUpdate('description', (e.target as HTMLTextAreaElement).value)}
        placeholder="What will this session work on?"
        rows={3}
        class="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500 resize-none"
      />
    </div>

    <div class="space-y-2">
      <Label for="git-repo" class="text-neutral-300">Git Repository</Label>
      <Input
        id="git-repo"
        value={gitRepoUrl}
        oninput={(e: Event) => onUpdate('gitRepoUrl', (e.target as HTMLInputElement).value)}
        placeholder="https://github.com/user/repo"
        class="bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500"
      />
      <p class="text-xs text-neutral-500">Optional. Repository will be cloned into the session.</p>
    </div>
  </div>
</div>
