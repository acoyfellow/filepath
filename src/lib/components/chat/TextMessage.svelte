<script lang="ts">
  interface Props {
    from: "u" | "a";
    text: string;
  }

  let { from, text }: Props = $props();

  /** Split text on backtick-wrapped segments for inline code rendering */
  function parseInlineCode(input: string): Array<{ code: boolean; text: string }> {
    const parts: Array<{ code: boolean; text: string }> = [];
    const regex = /`([^`]+)`/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ code: false, text: input.slice(lastIndex, match.index) });
      }
      parts.push({ code: true, text: match[1] });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < input.length) {
      parts.push({ code: false, text: input.slice(lastIndex) });
    }
    return parts;
  }

  let segments = $derived(parseInlineCode(text));
</script>

{#if from === "u"}
  <div class="msg msg-u">
    <div class="bubble-user">
      {#each segments as seg}
        {#if seg.code}<code class="ic">{seg.text}</code>{:else}{seg.text}{/if}
      {/each}
    </div>
  </div>
{:else}
  <div class="msg msg-a">
    <div class="bubble-agent">
      {#each segments as seg}
        {#if seg.code}<code class="ic">{seg.text}</code>{:else}{seg.text}{/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .msg { margin-bottom: 14px; }
  .msg-u { display: flex; justify-content: flex-end; }
  .msg-a { display: flex; }

  .bubble-user {
    max-width: 75%;
    padding: 10px 16px;
    background: var(--bubble-u);
    border: 1px solid var(--bubble-ub);
    border-radius: 14px 14px 4px 14px;
    font-size: 13px;
    color: var(--t2);
    line-height: 1.7;
    white-space: pre-wrap;
  }

  .bubble-agent {
    font-size: 13.5px;
    color: var(--t2);
    line-height: 1.75;
    white-space: pre-wrap;
  }

  .ic {
    background: var(--code-bg);
    padding: 1px 5px;
    border-radius: 3px;
    font-family: var(--m);
    font-size: 12px;
    color: var(--t3);
  }
</style>
