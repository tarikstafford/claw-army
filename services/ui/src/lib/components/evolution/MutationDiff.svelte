<script lang="ts">
  import { onMount } from 'svelte';

  export type MutationType = 'substitution' | 'amplification' | 'attenuation' | 'recombination' | 'introduction';

  interface Props {
    childSoulId: string;
    parentSoulId: string;
    mutationType: MutationType;
    onClose: () => void;
  }

  let { childSoulId, parentSoulId, mutationType, onClose }: Props = $props();

  interface SoulData {
    soulContent: string;
    dimensions: Record<string, string>;
    constitutionDirectives: string[];
    generation: number;
    archetypeName: string | null;
  }

  let parentSoul = $state<SoulData | null>(null);
  let childSoul = $state<SoulData | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const MUTATION_LABELS: Record<MutationType, string> = {
    substitution: 'SUBSTITUTION',
    amplification: 'AMPLIFICATION',
    attenuation: 'ATTENUATION',
    recombination: 'RECOMBINATION',
    introduction: 'INTRODUCTION',
  };

  const MUTATION_COLORS: Record<MutationType, string> = {
    substitution: 'var(--accent)',
    amplification: 'var(--karma)',
    attenuation: 'var(--accent-teal)',
    recombination: 'var(--text-muted)',
    introduction: 'var(--accent-rose)',
  };

  interface DiffLine {
    type: 'added' | 'removed' | 'unchanged';
    content: string;
  }

  interface DiffSection {
    header: string;
    lines: DiffLine[];
    changed: boolean;
  }

  const diffSections = $derived.by((): DiffSection[] => {
    if (!parentSoul?.soulContent || !childSoul?.soulContent) return [];

    const parentSections = parseSoulSections(parentSoul.soulContent);
    const childSections = parseSoulSections(childSoul.soulContent);

    const allHeaders = new Set([...Object.keys(parentSections), ...Object.keys(childSections)]);
    const result: DiffSection[] = [];

    for (const header of allHeaders) {
      const parentLines = parentSections[header] ?? [];
      const childLines = childSections[header] ?? [];
      const changed = parentLines.join('\n') !== childLines.join('\n');

      if (!changed && parentLines.length > 0) {
        result.push({ header, lines: parentLines.map(c => ({ type: 'unchanged' as const, content: c })), changed: false });
        continue;
      }

      const maxLen = Math.max(parentLines.length, childLines.length);
      const diffLines: DiffLine[] = [];

      for (let i = 0; i < maxLen; i++) {
        const p = parentLines[i];
        const c = childLines[i];
        if (p === undefined && c !== undefined) {
          diffLines.push({ type: 'added', content: c });
        } else if (p !== undefined && c === undefined) {
          diffLines.push({ type: 'removed', content: p });
        } else if (p !== c) {
          if (p !== undefined) diffLines.push({ type: 'removed', content: p });
          if (c !== undefined) diffLines.push({ type: 'added', content: c });
        } else {
          diffLines.push({ type: 'unchanged', content: p });
        }
      }

      result.push({ header, lines: diffLines, changed });
    }

    return result;
  });

  function parseSoulSections(content: string): Record<string, string[]> {
    const sections: Record<string, string[]> = {};
    const parts = content.split(/^## /m);

    for (const part of parts) {
      if (!part.trim()) continue;
      const newlineIdx = part.indexOf('\n');
      if (newlineIdx === -1) continue;
      const header = part.slice(0, newlineIdx).trim();
      const body = part.slice(newlineIdx + 1).trim();
      sections[header] = body.split('\n').filter(l => l.trim());
    }

    return sections;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  onMount(() => {
    async function fetchSouls() {
      try {
        const [parentRes, childRes] = await Promise.all([
          fetch(`/api/akasa/souls/${parentSoulId}`),
          fetch(`/api/akasa/souls/${childSoulId}`),
        ]);

        if (!parentRes.ok) throw new Error(`Parent soul fetch failed: ${parentRes.status}`);
        if (!childRes.ok) throw new Error(`Child soul fetch failed: ${childRes.status}`);

        const parentData = await parentRes.json();
        const childData = await childRes.json();

        parentSoul = {
          soulContent: parentData.soulContent,
          dimensions: parentData.dimensions,
          constitutionDirectives: parentData.constitutionDirectives,
          generation: parentData.generation,
          archetypeName: parentData.archetypeName,
        };

        childSoul = {
          soulContent: childData.soulContent,
          dimensions: childData.dimensions,
          constitutionDirectives: childData.constitutionDirectives,
          generation: childData.generation,
          archetypeName: childData.archetypeName,
        };
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to load soul data';
      } finally {
        loading = false;
      }
    }

    fetchSouls();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="diff-backdrop" onclick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Soul mutation diff">
  <div class="diff-panel">
    <header class="diff-header">
      <div class="diff-title-row">
        <span
          class="mutation-badge"
          style="color: {MUTATION_COLORS[mutationType]}; border-color: {MUTATION_COLORS[mutationType]};"
        >
          {MUTATION_LABELS[mutationType]}
        </span>
        <h2 class="diff-title">Mutation Diff</h2>
      </div>
      <button class="close-btn" onclick={onClose} aria-label="Close diff viewer">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </header>

    <div class="diff-meta">
      <span class="meta-item">
        <span class="meta-label">GENERATION</span>
        <span class="meta-value">G{parentSoul?.generation ?? '?'} → G{childSoul?.generation ?? '?'}</span>
      </span>
      {#if parentSoul?.archetypeName}
        <span class="meta-item">
          <span class="meta-label">PARENT</span>
          <span class="meta-value">{parentSoul.archetypeName}</span>
        </span>
      {/if}
      {#if childSoul?.archetypeName}
        <span class="meta-item">
          <span class="meta-label">CHILD</span>
          <span class="meta-value">{childSoul.archetypeName}</span>
        </span>
      {/if}
    </div>

    <div class="diff-body">
      {#if loading}
        <div class="diff-loading">
          <span class="loading-text">Loading soul comparison…</span>
        </div>
      {:else if error}
        <div class="diff-error">
          <span class="error-text">{error}</span>
        </div>
      {:else if diffSections.length === 0}
        <div class="diff-empty">
          <span class="empty-text">No content to compare</span>
        </div>
      {:else}
        {#each diffSections as section}
          <div class="diff-section" class:changed={section.changed}>
            <div class="section-header-row">
              <h3 class="section-header">{section.header}</h3>
              {#if section.changed}
                <span class="changed-indicator">CHANGED</span>
              {/if}
            </div>
            <div class="section-lines">
              {#each section.lines as line}
                <div
                  class="diff-line"
                  class:line-added={line.type === 'added'}
                  class:line-removed={line.type === 'removed'}
                >
                  <span class="line-marker">{line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}</span>
                  <span class="line-content">{line.content}</span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .diff-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(6, 5, 14, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: var(--space-lg);
  }

  .diff-panel {
    background: var(--card);
    border: 1px solid var(--accent-m);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 760px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .diff-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-lg) var(--space-xl);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .diff-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .mutation-badge {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.12em;
    padding: 3px 8px;
    border: 1px solid;
    border-radius: 3px;
  }

  .diff-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: var(--space-xs);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s;
  }

  .close-btn:hover {
    color: var(--text);
  }

  .diff-meta {
    display: flex;
    gap: var(--space-xl);
    padding: var(--space-md) var(--space-xl);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    flex-shrink: 0;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .meta-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--text-muted);
  }

  .meta-value {
    font-family: var(--font-label);
    font-size: 7px;
    color: var(--text-muted);
  }

  .diff-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-lg) var(--space-xl);
  }

  .diff-loading,
  .diff-error,
  .diff-empty {
    padding: var(--space-2xl);
    text-align: center;
  }

  .loading-text,
  .empty-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
  }

  .error-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--accent-rose);
  }

  .diff-section {
    margin-bottom: var(--space-xl);
  }

  .diff-section.changed .section-header {
    color: var(--accent);
  }

  .section-header-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
  }

  .section-header {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    margin: 0;
  }

  .changed-indicator {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--accent);
    padding: 2px 5px;
    border: 1px solid var(--accent);
    border-radius: 2px;
  }

  .section-lines {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .diff-line {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    padding: 3px var(--space-md);
    font-family: var(--font-body);
    font-size: 12px;
    line-height: 1.6;
  }

  .line-added {
    background: rgba(0, 209, 176, 0.06);
    color: var(--accent-teal);
  }

  .line-removed {
    background: rgba(251, 113, 133, 0.08);
    color: var(--accent-rose);
  }

  .line-marker {
    font-family: var(--font-label);
    font-size: 10px;
    width: 12px;
    flex-shrink: 0;
    text-align: center;
  }

  .line-content {
    white-space: pre-wrap;
    word-break: break-word;
    color: inherit;
  }

  .diff-section:not(.changed) .diff-line:not(.line-added):not(.line-removed) {
    color: var(--text-muted);
  }
</style>