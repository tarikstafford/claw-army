<script lang="ts">
  import type { Skill, CreateSkillInput, UpdateSkillInput } from '$lib/api.js';

  let { skill, onsave, oncancel }: {
    skill?: Skill;
    onsave?: (data: CreateSkillInput | UpdateSkillInput) => void;
    oncancel?: () => void;
  } = $props();

  let name = $state(skill?.name ?? '');
  let category = $state(skill?.category ?? '');
  let triggerText = $state(skill?.triggerPatterns.join(', ') ?? '');
  let content = $state(skill?.content ?? '');
  let errors = $state<Record<string, string>>({});

  function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { data: {}, body: raw };
    const data: Record<string, string> = {};
    for (const line of match[1].split('\n')) {
      const [key, ...vals] = line.split(':');
      if (key && vals.length > 0) data[key.trim()] = vals.join(':').trim();
    }
    return { data, body: match[2] ?? '' };
  }

  function serialize(nameVal: string, cat: string, triggers: string[], body: string): string {
    return `---\nname: ${nameVal}\ncategory: ${cat}\ntriggers:\n${triggers.map(t => `  - ${t}`).join('\n')}\n---\n${body}`;
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!category.trim()) errs.category = 'Category is required';
    if (!content.trim()) errs.content = 'Content is required';
    errors = errs;
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    const triggers = triggerText.split(',').map(t => t.trim()).filter(Boolean);
    const serialized = serialize(name, category, triggers, content);
    onsave?.({ name, category, triggerPatterns: triggers, content: serialized });
  }
</script>

<div class="skill-editor">
  <div class="editor-header">
    <h3 class="editor-title">{skill ? 'Edit Skill' : 'New Skill'}</h3>
  </div>

  <div class="editor-form">
    <div class="field">
      <label class="field-label" for="skill-name">NAME</label>
      <input
        id="skill-name"
        class="field-input"
        class:error={!!errors.name}
        type="text"
        bind:value={name}
        placeholder="e.g. Precision Targeting"
      />
      {#if errors.name}
        <span class="field-error">{errors.name}</span>
      {/if}
    </div>

    <div class="field">
      <label class="field-label" for="skill-category">CATEGORY</label>
      <input
        id="skill-category"
        class="field-input"
        class:error={!!errors.category}
        type="text"
        bind:value={category}
        placeholder="e.g. execution, planning, communication"
      />
      {#if errors.category}
        <span class="field-error">{errors.category}</span>
      {/if}
    </div>

    <div class="field">
      <label class="field-label" for="skill-triggers">TRIGGER PATTERNS <span class="field-hint">(comma-separated)</span></label>
      <input
        id="skill-triggers"
        class="field-input"
        type="text"
        bind:value={triggerText}
        placeholder="e.g. on low confidence, before major decisions"
      />
    </div>

    <div class="field">
      <label class="field-label" for="skill-content">SKILL.md CONTENT</label>
      <textarea
        id="skill-content"
        class="field-textarea"
        class:error={!!errors.content}
        bind:value={content}
        rows={14}
        placeholder="Write your skill content in Markdown. YAML frontmatter is auto-generated."
      ></textarea>
      {#if errors.content}
        <span class="field-error">{errors.content}</span>
      {/if}
    </div>
  </div>

  <div class="editor-actions">
    {#if oncancel}
      <button class="btn-cancel" onclick={oncancel}>Cancel</button>
    {/if}
    <button class="btn-save" onclick={handleSave}>
      {skill ? 'Save Changes' : 'Create Skill'}
    </button>
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

  .editor-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .field-label {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    color: var(--bo-caption);
  }

  .field-hint {
    font-family: var(--font-body);
    font-size: 10px;
    color: var(--bo-faint);
    letter-spacing: 0;
  }

  .field-input,
  .field-textarea {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--bo-text);
    background: var(--bo-bg);
    border: 1px solid var(--bo-border);
    border-radius: var(--radius-sm);
    padding: var(--space-sm) var(--space-md);
    outline: none;
    transition: border-color 0.15s ease;
    resize: vertical;
  }

  .field-input:focus,
  .field-textarea:focus {
    border-color: var(--bo-violet);
  }

  .field-input.error,
  .field-textarea.error {
    border-color: var(--bo-rose);
  }

  .field-textarea {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .field-error {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--bo-rose);
  }

  .editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    border-top: 1px solid var(--bo-border);
    padding-top: var(--space-md);
  }

  .btn-cancel,
  .btn-save {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.10em;
    padding: 6px 16px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .btn-cancel {
    background: none;
    border: 1px solid var(--bo-border);
    color: var(--bo-faint);
  }

  .btn-cancel:hover {
    border-color: var(--bo-muted);
    color: var(--bo-text);
  }

  .btn-save {
    background: var(--bo-violet);
    border: 1px solid var(--bo-violet);
    color: var(--bo-text);
  }

  .btn-save:hover {
    background: var(--bo-vb);
    border-color: var(--bo-vb);
  }
</style>
