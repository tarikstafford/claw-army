<script lang="ts">
  const CLASS_COLORS: Record<string, string> = {
    Artisan: 'var(--bo-amber)',
    Understudy: 'var(--bo-vb)',
    Novice: 'var(--bo-muted)',
    Retired: 'var(--bo-faint)',
  };

  let { botId, currentClass, archetypeName, taskCategory, isPioneer, compositeScore, status }: {
    botId: string;
    currentClass: string | null;
    archetypeName: string | null;
    taskCategory: string | null;
    isPioneer: boolean;
    compositeScore: string | null;
    status: string | null;
  } = $props();

  const classColor = $derived(
    currentClass ? (CLASS_COLORS[currentClass] ?? 'var(--bo-muted)') : 'var(--bo-muted)'
  );

  const statusDotColor = $derived(
    status === 'active' || status === 'running' ? 'var(--bo-teal)' :
    status === 'error' || status === 'failed' ? 'var(--bo-rose)' :
    'var(--bo-faint)'
  );
</script>

<div class="identity-card">
  <div class="identity-left">
    <div class="bot-name-row">
      <span class="bot-name">{botId.slice(0, 8)}</span>
      {#if currentClass}
        <span
          class="class-badge"
          style="color: {classColor}; border-color: {classColor}"
        >{currentClass.toUpperCase()}</span>
      {/if}
      {#if isPioneer}
        <span class="pioneer-badge">PIONEER</span>
      {/if}
    </div>
    {#if archetypeName}
      <span class="archetype-label">Archetype: {archetypeName}</span>
    {/if}
  </div>

  <div class="identity-right">
    <div class="score-block">
      <span class="score-value">
        {compositeScore ? parseFloat(compositeScore).toFixed(2) : '—'}
      </span>
      <span class="score-label">COMPOSITE</span>
    </div>
    <div class="meta-block">
      {#if taskCategory}
        <span class="category-label">{taskCategory}</span>
      {/if}
      <div class="status-row">
        <span class="status-dot" style="background: {statusDotColor}"></span>
        <span class="status-text">{status ?? '—'}</span>
      </div>
    </div>
  </div>
</div>

<style>
  .identity-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    gap: var(--space-xl);
  }

  .identity-left {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    min-width: 0;
  }

  .bot-name-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  .bot-name {
    font-family: var(--font-mono);
    font-size: 20px;
    color: var(--bo-violet);
    letter-spacing: 0.02em;
  }

  .class-badge {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    border: 1px solid;
    border-radius: var(--radius-sm);
    padding: 3px 7px;
    background: transparent;
  }

  .pioneer-badge {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-amber);
    background: rgba(251, 191, 36, 0.10);
    border: 1px solid rgba(251, 191, 36, 0.32);
    padding: 3px 7px;
    border-radius: 3px;
  }

  .archetype-label {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-caption);
  }

  .identity-right {
    display: flex;
    align-items: center;
    gap: var(--space-xl);
    flex-shrink: 0;
  }

  .score-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .score-value {
    font-family: var(--font-label);
    font-size: 20px;
    color: var(--bo-amber);
    line-height: 1;
  }

  .score-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-caption);
  }

  .meta-block {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-xs);
  }

  .category-label {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-muted);
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-text {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: var(--bo-caption);
    text-transform: uppercase;
  }
</style>
