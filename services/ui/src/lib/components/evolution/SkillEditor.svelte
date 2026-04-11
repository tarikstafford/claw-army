<script lang="ts">
  import type { Skill, CreateSkillInput, SkillCategory, SkillSource } from '$lib/api';

  let {
    skill,
    mode = 'create',
    onsave,
    oncancel,
  }: {
    skill?: Skill;
    mode?: 'create' | 'edit';
    onsave?: (data: CreateSkillInput) => void;
    oncancel?: () => void;
  } = $props();

  let name = $state(skill?.name ?? '');
  let category = $state<SkillCategory>(skill?.category ?? 'reasoning');
  let source = $state<SkillSource>(skill?.source ?? 'authored');
  let triggerPatternsRaw = $state(skill?.triggerPatterns.join(', ') ?? '');
  let content = $state(skill?.content ?? '');

  const CATEGORIES: SkillCategory[] = ['reasoning', 'communication', 'tool-use', 'memory', 'coordination'];
  const SOURCES: SkillSource[] = ['authored', 'learned', 'acquired'];

  function parseTriggerPatterns(raw: string): string[] {
    return raw.split(',').map(p => p.trim()).filter(Boolean);
  }

  function handleSave() {
    if (!name.trim()) return;
    const data: CreateSkillInput = {
      name: name.trim(),
      category,
      source,
      triggerPatterns: parseTriggerPatterns(triggerPatternsRaw),
      content,
    };
    onsave?.(data);
  }

  const isValid = $derived(name.trim().length > 0);
</script>

<div class="skill-editor">
  <div class="editor-header">
    <h2 class="editor-title">{mode === 'create' ? 'Create Skill' : 'Edit Skill'}</h2>
  </div>

  <div class="form-grid">
    <div class="form-field">
      <label class="field-label" for="skill-name">NAME</label>
      <input
        id="skill-name"
        class="field-input"
        type="text"
        bind:value={name}
        placeholder="e.g. Context Summarizer"
      />
    </div>

    <div class="form-field">
      <label class="field-label" for="skill-category">CATEGORY</label>
      <select id="skill-category" class="field-select" bind:value={category}>
        {#each CATEGORIES as cat}
          <option value={cat}>{cat.toUpperCase()}</option>
        {/each}
      </select>
    </div>

    <div class="form-field">
      <label class="field-label" for="skill-source">SOURCE</label>
      <select id="skill-source" class="field-select" bind:value={source}>
        {#each SOURCES as src}
          <option value={src}>{src.toUpperCase()}</option>
        {/each}
      </select>
    </div>

    <div class="form-field full-width">
      <label class="field-label" for="skill-triggers">TRIGGER PATTERNS <span class="field-hint">(comma-separated)</span></label>
      <input
        id="skill-triggers"
        class="field-input"
        type="text"
        bind:value={triggerPatternsRaw}
        placeholder="e.g. summarize, context, brief"
      />
    </div>

    <div class="form-field full-width">
      <label class="field-label" for="skill-content">SKILL.md CONTENT</label>
      <textarea
        id="skill-content"
        class="field-textarea"
        bind:value={content}
        placeholder="# Skill Name&#10;&#10;## Trigger&#10;When to use this skill.&#10;&#10;## Behavior&#10;What the agent does.&#10;&#10;## Examples&#10;- Example 1"
        rows="12"
      ></textarea>
    </div>
  </div>

  <div class="editor-actions">
    <button
      class="btn btn-save"
      disabled={!isValid}
      onclick={handleSave}
    >
      {mode === 'create' ? 'Create Skill' : 'Save Changes'}
    </button>
    {#if oncancel}
      <button class="btn btn-cancel" onclick={oncancel}>Cancel</button>
    {/if}
  </div>
</div>

<style>
  .skill-editor {
    background: var(--bo-card);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-xl);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .editor-header {
    border-bottom: 1px solid var(--bo-border);
    padding-bottom: var(--space-md);
  }

  .editor-title {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--bo-text);
    margin: 0;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-lg);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .form-field.full-width {
    grid-column: 1 / -1;
  }

  .field-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-caption);
    display: block;
  }

  .field-hint {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-faint);
    letter-spacing: 0;
    text-transform: none;
  }

  .field-input,
  .field-select,
  .field-textarea {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-text);
    background: var(--bo-bg);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-sm);
    padding: var(--space-sm) var(--space-md);
    width: 100%;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
  }

  .field-input:focus,
  .field-select:focus,
  .field-textarea:focus {
    outline: none;
    border-color: var(--bo-violet);
  }

  .field-textarea {
    resize: vertical;
    min-height: 200px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.6;
  }

  .editor-actions {
    display: flex;
    gap: var(--space-md);
    align-items: center;
    padding-top: var(--space-md);
    border-top: 1px solid var(--bo-border);
  }

  .btn {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s ease;
    min-height: 36px;
  }

  .btn-save {
    background: var(--bo-violet);
    color: var(--bo-bg);
    border: 1px solid var(--bo-violet);
  }

  .btn-save:hover:not(:disabled) {
    background: rgba(168, 144, 255, 0.80);
  }

  .btn-save:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-cancel {
    background: transparent;
    color: var(--bo-faint);
    border: 1px solid var(--bo-border);
  }

  .btn-cancel:hover {
    background: rgba(168, 144, 255, 0.06);
  }
</style>
