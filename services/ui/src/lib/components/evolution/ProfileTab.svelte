<script lang="ts">
  import SoulRadar from '$lib/components/evolution/SoulRadar.svelte';

  const CLASS_COLORS: Record<string, string> = {
    Artisan: 'var(--bo-amber)',
    Understudy: 'var(--bo-vb)',
    Novice: 'var(--bo-muted)',
    Retired: 'var(--bo-faint)',
  };

  let { dimensions, soulContent, constitutionDirectives, generation, classHistory, archetypeName }: {
    dimensions: Record<string, string> | null;
    soulContent: string | null;
    constitutionDirectives: string[] | null;
    generation: number | null;
    classHistory: Array<{ class: string; transitionAt: string; category: string }>;
    archetypeName: string | null;
  } = $props();

  interface SoulSection {
    header: string;
    body: string;
  }

  const soulSections = $derived<SoulSection[]>((): SoulSection[] => {
    if (!soulContent) return [];
    const parts = soulContent.split(/^## /m);
    return parts
      .filter(p => p.trim())
      .map(p => {
        const newlineIdx = p.indexOf('\n');
        if (newlineIdx === -1) return { header: p.trim(), body: '' };
        return {
          header: p.slice(0, newlineIdx).trim(),
          body: p.slice(newlineIdx + 1).trim(),
        };
      });
  });

  function formatDate(ts: string): string {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
</script>

<div class="profile-tab">

  <!-- Section: Soul Dimensions Radar -->
  <section class="profile-section">
    <h3 class="section-title">Soul Dimensions</h3>
    <SoulRadar {dimensions} />
  </section>

  <!-- Section: SOUL.md -->
  <section class="profile-section">
    <h3 class="section-title">SOUL.md</h3>
    {#if soulContent === null}
      <p class="placeholder-text">No soul document</p>
    {:else if soulSections.length === 0}
      <div class="soul-section-body">
        <p class="soul-body-text">{soulContent}</p>
      </div>
    {:else}
      <div class="soul-viewer">
        {#each soulSections as section}
          <div class="soul-section-block">
            <h4 class="soul-section-header">{section.header}</h4>
            {#if section.body}
              <p class="soul-body-text">{section.body}</p>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Section: Constitution Directives -->
  <section class="profile-section">
    <h3 class="section-title">Constitution Directives</h3>
    {#if !constitutionDirectives || constitutionDirectives.length === 0}
      <p class="placeholder-text">No directives defined</p>
    {:else}
      <ol class="directives-list">
        {#each constitutionDirectives as directive}
          <li class="directive-item">{directive}</li>
        {/each}
      </ol>
    {/if}
  </section>

  <!-- Section: Class Progression -->
  <section class="profile-section">
    <h3 class="section-title">Class Progression</h3>
    {#if classHistory.length === 0}
      <div class="class-fallback">
        {#if generation !== null}
          <span class="fallback-item">Generation {generation}</span>
        {/if}
        {#if archetypeName}
          <span class="fallback-item">{archetypeName}</span>
        {/if}
        {#if generation === null && archetypeName === null}
          <p class="placeholder-text">No class history</p>
        {/if}
      </div>
    {:else}
      <div class="class-stepper">
        {#each classHistory as entry, i}
          {#if i > 0}
            <div class="stepper-connector"></div>
          {/if}
          <div class="stepper-step">
            <div
              class="stepper-circle"
              style="border-color: {CLASS_COLORS[entry.class] ?? 'var(--bo-faint)'}; background: {CLASS_COLORS[entry.class] ? `color-mix(in srgb, ${CLASS_COLORS[entry.class]} 12%, transparent)` : 'transparent'}"
            ></div>
            <span
              class="stepper-class"
              style="color: {CLASS_COLORS[entry.class] ?? 'var(--bo-faint)'}"
            >{entry.class.toUpperCase()}</span>
            <span class="stepper-date">{formatDate(entry.transitionAt)}</span>
          </div>
        {/each}
      </div>
    {/if}
  </section>

</div>

<style>
  .profile-tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-xl);
  }

  .profile-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .section-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0 0 var(--space-md);
  }

  .placeholder-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-faint);
    margin: 0;
  }

  /* SOUL.md viewer */
  .soul-viewer {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
  }

  .soul-section-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .soul-section-body {
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
  }

  .soul-section-header {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
    color: var(--bo-violet);
    margin: 0;
  }

  .soul-body-text {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-muted);
    white-space: pre-wrap;
    margin: 0;
    line-height: 1.7;
  }

  /* Directives list */
  .directives-list {
    padding-left: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .directive-item {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-text);
    line-height: 1.6;
  }

  /* Class stepper */
  .class-stepper {
    display: flex;
    align-items: flex-start;
    gap: 0;
    flex-wrap: wrap;
  }

  .stepper-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 72px;
  }

  .stepper-circle {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid;
    flex-shrink: 0;
  }

  .stepper-class {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    text-align: center;
  }

  .stepper-date {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-caption);
    text-align: center;
  }

  .stepper-connector {
    width: 24px;
    height: 2px;
    background: var(--bo-border);
    margin-top: 9px;
    flex-shrink: 0;
  }

  /* Fallback */
  .class-fallback {
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .fallback-item {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-muted);
  }
</style>
