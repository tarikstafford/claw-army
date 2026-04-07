<script lang="ts">
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';

  let { content }: { content: string } = $props();

  marked.setOptions({ breaks: true, gfm: true });

  let html = $derived(DOMPurify.sanitize(marked.parse(content) as string));
</script>

<div class="md-content">{@html html}</div>

<style>
  .md-content {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.8;
    color: var(--text);
    word-break: break-word;
  }

  .md-content :global(p) { margin: 0 0 0.6em; }
  .md-content :global(p:last-child) { margin-bottom: 0; }
  .md-content :global(strong) { font-weight: 600; }
  .md-content :global(em) { font-style: italic; }

  .md-content :global(code) {
    font-family: var(--font-mono);
    font-size: 12px;
    background: var(--bg2);
    padding: 2px 5px;
    border-radius: 3px;
  }

  .md-content :global(pre) {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    overflow-x: auto;
    margin: 0.6em 0;
  }

  .md-content :global(pre code) {
    background: none;
    padding: 0;
  }

  .md-content :global(ul), .md-content :global(ol) {
    margin: 0.4em 0;
    padding-left: 1.5em;
  }

  .md-content :global(li) { margin-bottom: 0.2em; }

  .md-content :global(a) {
    color: var(--accent);
    text-decoration: underline;
  }

  .md-content :global(blockquote) {
    border-left: 3px solid var(--accent-dim);
    padding-left: 12px;
    margin: 0.6em 0;
    color: var(--text-muted);
  }

  .md-content :global(h1), .md-content :global(h2), .md-content :global(h3) {
    font-family: var(--font-display);
    font-weight: 600;
    margin: 0.8em 0 0.3em;
    color: var(--text);
  }

  .md-content :global(h1) { font-size: 20px; }
  .md-content :global(h2) { font-size: 17px; }
  .md-content :global(h3) { font-size: 15px; }

  .md-content :global(hr) {
    border: none;
    border-top: 1px solid var(--border);
    margin: 1em 0;
  }
</style>
