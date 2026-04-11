<script lang="ts">
  import type { CreateSkillInput, SkillCategory, SkillSource } from '$lib/api';

  let {
    initialContent = '',
    initialName = '',
    initialCategory = 'execution' as SkillCategory,
    initialTriggerPatterns = [],
    initialSource = 'authored' as SkillSource,
    onSave,
    onCancel
  }: {
    initialContent?: string;
    initialName?: string;
    initialCategory?: SkillCategory;
    initialTriggerPatterns?: string[];
    initialSource?: SkillSource;
    onSave?: (input: CreateSkillInput) => void;
    onCancel?: () => void;
  } = $props();

  let name = $state(initialName);
  let category = $state(initialCategory);
  let triggerInput = $state(initialTriggerPatterns.join(', '));
  let source = $state(initialSource);
  let content = $state(initialContent);
  let isEditing = $state(false);

  const CATEGORIES: SkillCategory[] = ['communication', 'reasoning', 'execution', 'coordination', 'creative'];
  const SOURCES: SkillSource[] = ['authored', 'learned', 'acquired'];

  function parseTriggerPatterns(input: string): string[] {
    return input.split(',').map(p => p.trim()).filter(p => p.length > 0);
  }

  function handleSave() {
    if (!name.trim()) return;
    const input: CreateSkillInput = {
      name: name.trim(),
      category,
      triggerPatterns: parseTriggerPatterns(triggerInput),
      content,
    };
    onSave?.(input);
  }

  function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: raw };
    const frontmatter: Record<string, string> = {};
    for (const line of match[1].split('\n')) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        frontmatter[key.trim()] = valueParts.join(':').trim();
      }
    }
    return { frontmatter, body: match[2] };
  }

  function serializeFrontmatter(data: Record<string, string>, body: string): string {
    const fm = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join('\n');
    return `---\n${fm}\n---\n${body}`;
  }

  let parsed = $derived(parseFrontmatter(content));
  let displayContent = $derived(isEditing ? content : parsed.body);
  let fmData = $derived(parsed.frontmatter);

  let editRaw = $state(content);

  function startEditing() {
    editRaw = content;
    isEditing = true;
  }

  function cancelEditing() {
    isEditing = false;
  }

  function applyEdits() {
    content = editRaw;
    const { frontmatter, body } = parseFrontmatter(editRaw);
    if (frontmatter.name) name = frontmatter.name;
    if (frontmatter.category) category = frontmatter.category as SkillCategory;
    if (frontmatter.triggers) triggerInput = frontmatter.triggers;
    if (frontmatter.source) source = frontmatter.source as SkillSource;
    content = serializeFrontmatter({ name, category, source, triggers: triggerInput }, body);
    isEditing = false;
  }
</script>

<div class="skill-editor">
  <div class="editor-header">
    <span class="editor-label">SKILL.md EDITOR</span>
    <div class="editor-actions">
      {#if isEditing}
        <button class="btn-apply" onclick={applyEdits}>Apply</button>
        <button class="btn-cancel" onclick={cancelEditing}>Cancel</button>
      {:else}
        <button class="btn-edit" onclick={startEditing}>Edit</button>
      {/if}
    </div>
  </div>

  {#if isEditing}
    <textarea
      class="editor-textarea"
      bind:value={editRaw}
      placeholder="name: My Skill
category: execution
source: authored
triggers: pattern1, pattern2

## Description

Your skill content here..."
      rows={20}
    ></textarea>
  {:else}
    <div class="editor-preview">
      <div class="fm-section">
        <div class="fm-row">
          <span class="fm-label">NAME</span>
          <span class="fm-value">{name || '—'}</span>
        </div>
        <div class="fm-row">
          <span class="fm-label">CATEGORY</span>
          <span class="fm-value">{category.toUpperCase()}</span>
        </div>
        <div class="fm-row">
          <span class="fm-label">SOURCE</span>
          <span class="fm-value">{source.toUpperCase()}</span>
        </div>
        <div class="fm-row">
          <span class="fm-label">TRIGGERS</span>
          <span class="fm-value">{triggerInput || '—'}</span>
        </div>
      </div>
      {#if displayContent}
        <div class="body-content">{displayContent}</div>
      {/if}
    </div>
  {/if}

  <div class="editor-footer">
    <div class="form-group">
      <label class="form-label" for="skill-name">NAME</label>
      <input
        id="skill-name"
        class="form-input"
        type="text"
        bind:value={name}
        placeholder="Skill name"
      />
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="skill-category">CATEGORY</label>
        <select id="skill-category" class="form-select" bind:value={category}>
          {#each CATEGORIES as cat}
            <option value={cat}>{cat.toUpperCase()}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="skill-source">SOURCE</label>
        <select id="skill-source" class="form-select" bind:value={source}>
          {#each SOURCES as src}
            <option value={src}>{src.toUpperCase()}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" for="skill-triggers">TRIGGER PATTERNS</label>
      <input
        id="skill-triggers"
        class="form-input"
        type="text"
        bind:value={triggerInput}
        placeholder="pattern1, pattern2, pattern3"
      />
      <span class="form-hint">Comma-separated trigger phrases</span>
    </div>

    <div class="form-actions">
      <button class="btn-secondary" onclick={() => onCancel?.()}>Cancel</button>
      <button class="btn-primary" onclick={handleSave} disabled={!name.trim()}>Save Skill</button>
    </div>
  </div>
</div>

<style>
  .skill-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--bo-border);
  }

  .editor-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-muted);
  }

  .editor-actions {
    display: flex;
    gap: var(--space-sm);
  }

  .btn-edit, .btn-apply, .btn-cancel {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.08em;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-edit {
    background: var(--bo-ghost);
    border: 1px solid var(--bo-border);
    color: var(--bo-muted);
  }

  .btn-edit:hover {
    border-color: var(--bo-violet);
    color: var(--bo-text);
  }

  .btn-apply {
    background: var(--bo-violet);
    border: 1px solid var(--bo-violet);
    color: #fff;
  }

  .btn-apply:hover {
    background: var(--bo-vb);
  }

  .btn-cancel {
    background: transparent;
    border: 1px solid var(--bo-border);
    color: var(--bo-muted);
  }

  .btn-cancel:hover {
    border-color: var(--bo-rose);
    color: var(--bo-rose);
  }

  .editor-textarea {
    width: 100%;
    min-height: 300px;
    background: var(--bo-bg);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    color: var(--bo-text);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: var(--space-md);
    resize: vertical;
    line-height: 1.6;
  }

  .editor-textarea:focus {
    outline: none;
    border-color: var(--bo-violet);
  }

  .editor-preview {
    background: var(--bo-bg);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-md);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .fm-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--bo-border);
  }

  .fm-row {
    display: flex;
    gap: var(--space-md);
  }

  .fm-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
    color: var(--bo-faint);
    min-width: 80px;
  }

  .fm-value {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--bo-text);
  }

  .body-content {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-muted);
    white-space: pre-wrap;
    line-height: 1.7;
  }

  .editor-footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding-top: var(--space-md);
    border-top: 1px solid var(--bo-border);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-md);
  }

  .form-label {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.08em;
    color: var(--bo-muted);
  }

  .form-input, .form-select {
    background: var(--bo-bg);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-sm);
    color: var(--bo-text);
    font-family: var(--font-body);
    font-size: 13px;
    padding: var(--space-sm) var(--space-md);
    transition: border-color 0.15s ease;
  }

  .form-input:focus, .form-select:focus {
    outline: none;
    border-color: var(--bo-violet);
  }

  .form-hint {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-faint);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    margin-top: var(--space-sm);
  }

  .btn-primary, .btn-secondary {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.08em;
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-primary {
    background: var(--bo-violet);
    border: 1px solid var(--bo-violet);
    color: #fff;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--bo-vb);
    border-color: var(--bo-vb);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--bo-border);
    color: var(--bo-muted);
  }

  .btn-secondary:hover {
    border-color: var(--bo-muted);
    color: var(--bo-text);
  }
</style>
