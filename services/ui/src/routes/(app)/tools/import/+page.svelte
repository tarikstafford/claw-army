<script lang="ts">
  import { invalidateAll } from '$app/navigation';

  let { data } = $props();

  // ── Import form state ──────────────────────────────────────────────
  let specUrl = $state('');
  let loading = $state(false);
  let errorMsg = $state<string | null>(null);
  let successMsg = $state<string | null>(null);
  let newlyImportedSpecId = $state<string | null>(null);

  // ── Preview state ──────────────────────────────────────────────────
  interface PreviewEndpoint {
    operationId: string | null;
    method: string;
    path: string;
    summary: string | null;
    description: string | null;
    tags: string[];
    selected: boolean;
  }

  let previewTitle = $state('');
  let previewVersion = $state('');
  let previewBaseUrl = $state('');
  let previewEndpoints = $state<PreviewEndpoint[]>([]);
  let showPreview = $state(false);
  let importing = $state(false);

  // ── Grouped registry entries by specId ─────────────────────────────
  interface RegistryEntry {
    id: string;
    specId: string;
    specTitle: string;
    specVersion: string | null;
    specUrl: string | null;
    baseUrl: string;
    operationId: string | null;
    method: string;
    path: string;
    summary: string | null;
    description: string | null;
    tags: string[] | null;
    isEnabled: boolean;
    createdAt: string;
  }

  interface SpecGroup {
    specId: string;
    specTitle: string;
    specVersion: string | null;
    specUrl: string | null;
    baseUrl: string;
    endpoints: RegistryEntry[];
    expanded: boolean;
  }

  let specGroups = $derived.by(() => {
    const entries = data.registry as RegistryEntry[];
    const groupMap = new Map<string, SpecGroup>();
    for (const entry of entries) {
      if (!groupMap.has(entry.specId)) {
        groupMap.set(entry.specId, {
          specId: entry.specId,
          specTitle: entry.specTitle,
          specVersion: entry.specVersion,
          specUrl: entry.specUrl,
          baseUrl: entry.baseUrl,
          endpoints: [],
          expanded: false,
        });
      }
      groupMap.get(entry.specId)!.endpoints.push(entry);
    }
    return Array.from(groupMap.values());
  });

  const allSelected = $derived(previewEndpoints.length > 0 && previewEndpoints.every(e => e.selected));
  const noneSelected = $derived(previewEndpoints.every(e => !e.selected));
  const selectedCount = $derived(previewEndpoints.filter(e => e.selected).length);

  // ── Actions ────────────────────────────────────────────────────────

  async function handlePreview() {
    if (!specUrl.trim()) return;

    loading = true;
    errorMsg = null;
    showPreview = false;

    try {
      const res = await fetch('/api/akasa/tool-registry/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specUrl: specUrl.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        const errMsg = body.error ?? `Failed to parse spec (${res.status})`;
        // Provide more helpful error messages for common spec parsing issues
        if (errMsg.includes('Invalid') || errMsg.includes('invalid') || errMsg.includes('JSON')) {
          errorMsg = `Invalid OpenAPI spec: ${errMsg}. Ensure your spec is valid JSON and conforms to the OpenAPI specification.`;
        } else if (errMsg.includes('not found') || errMsg.includes('404')) {
          errorMsg = `Could not fetch the spec from the provided URL. Please verify the URL is publicly accessible.`;
        } else if (errMsg.includes('timeout')) {
          errorMsg = `The spec request timed out. Please try again or use a shorter URL.`;
        } else if (errMsg.includes('unexpected') || errMsg.includes('parse')) {
          errorMsg = `Failed to parse the spec. Please ensure it is a valid OpenAPI 2.0 (Swagger) or 3.0 document.`;
        } else {
          errorMsg = errMsg;
        }
        return;
      }

      const parsed = await res.json();
      previewTitle = parsed.title;
      previewVersion = parsed.version ?? '';
      previewBaseUrl = parsed.baseUrl;
      previewEndpoints = parsed.endpoints.map((ep: PreviewEndpoint) => ({
        ...ep,
        selected: true,
      }));
      showPreview = true;
    } catch (err) {
      errorMsg = `Network error: ${(err as Error).message}. Please check your connection and try again.`;
    } finally {
      loading = false;
    }
  }

  function toggleAll() {
    const newVal = !allSelected;
    previewEndpoints = previewEndpoints.map(e => ({ ...e, selected: newVal }));
  }

  function toggleEndpoint(index: number) {
    previewEndpoints = previewEndpoints.map((e, i) =>
      i === index ? { ...e, selected: !e.selected } : e
    );
  }

  async function handleImport() {
    if (noneSelected) return;

    importing = true;
    errorMsg = null;

    const selectedEndpoints = previewEndpoints
      .filter(e => e.selected)
      .map(e => ({ method: e.method, path: e.path }));

    try {
      const res = await fetch('/api/akasa/tool-registry/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.userId,
          specUrl: specUrl.trim(),
          selectedEndpoints,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        const errMsg = body.error ?? `Import failed (${res.status})`;
        // Provide more helpful error messages for common issues
        if (errMsg.includes('Invalid') || errMsg.includes('invalid')) {
          errorMsg = `Invalid OpenAPI spec: ${errMsg}. Please check that your spec is a valid OpenAPI 2.0 or 3.0 document.`;
        } else if (errMsg.includes('not found') || errMsg.includes('404')) {
          errorMsg = `Could not fetch the spec from the provided URL. Please verify the URL is accessible.`;
        } else if (errMsg.includes('timeout')) {
          errorMsg = `The spec request timed out. Please try again or use a different URL.`;
        } else {
          errorMsg = errMsg;
        }
        return;
      }

      const imported = await res.json();
      const importedSpecId = imported[0]?.specId ?? null;
      if (importedSpecId) {
        newlyImportedSpecId = importedSpecId;
      }
      successMsg = `Imported ${imported.length} endpoint${imported.length === 1 ? '' : 's'} from ${previewTitle}`;
      showPreview = false;
      specUrl = '';
      previewEndpoints = [];

      // Refresh registry list
      await invalidateAll();

      setTimeout(() => { successMsg = null; }, 6000);
    } catch (err) {
      errorMsg = `Network error: ${(err as Error).message}. Please check your connection and try again.`;
    } finally {
      importing = false;
    }
  }

  async function handleDeleteSpec(specId: string) {
    try {
      const res = await fetch(`/api/akasa/tool-registry/${specId}?userId=${encodeURIComponent(data.userId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await invalidateAll();
      } else {
        errorMsg = 'Failed to remove imported spec';
        setTimeout(() => { errorMsg = null; }, 4000);
      }
    } catch {
      errorMsg = 'Failed to remove imported spec';
      setTimeout(() => { errorMsg = null; }, 4000);
    }
  }

  async function handleToggleEndpoint(entryId: string, currentEnabled: boolean) {
    try {
      await fetch(`/api/akasa/tool-registry/${entryId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.userId, isEnabled: !currentEnabled }),
      });
      await invalidateAll();
    } catch {
      errorMsg = 'Failed to toggle endpoint';
      setTimeout(() => { errorMsg = null; }, 4000);
    }
  }

  function toggleGroup(specId: string) {
    const group = specGroups.find(g => g.specId === specId);
    if (group) {
      group.expanded = !group.expanded;
    }
  }

  function methodColor(method: string): string {
    switch (method.toLowerCase()) {
      case 'get': return 'var(--bo-teal, #2DD4BF)';
      case 'post': return 'var(--bo-amber, #FBBF24)';
      case 'put': return 'var(--bo-vb, #A78BFA)';
      case 'patch': return 'var(--bo-rose, #F472B6)';
      case 'delete': return 'var(--error, #f87171)';
      default: return 'var(--text-muted)';
    }
  }
</script>

<div class="import-page">
  {#if successMsg}
    <div class="banner banner-success">{successMsg}</div>
  {/if}
  {#if errorMsg}
    <div class="banner banner-error">{errorMsg}</div>
  {/if}

  <!-- Import Form -->
  <section class="import-section">
    <h2 class="section-heading">Import OpenAPI Spec</h2>
    <p class="section-desc">Paste a URL to an OpenAPI or Swagger specification to auto-discover and register tool endpoints.</p>

    <div class="import-form">
      <input
        type="url"
        class="spec-input"
        placeholder="https://api.example.com/openapi.json"
        bind:value={specUrl}
        onkeydown={(e) => { if (e.key === 'Enter') handlePreview(); }}
        disabled={loading}
      />
      <button
        class="btn btn-preview"
        onclick={handlePreview}
        disabled={loading || !specUrl.trim()}
      >
        {loading ? 'Parsing...' : 'Preview'}
      </button>
    </div>
  </section>

  <!-- Preview Panel -->
  {#if showPreview}
    <section class="preview-section">
      <div class="preview-header">
        <div class="preview-meta">
          <h3 class="preview-title">{previewTitle}</h3>
          {#if previewVersion}
            <span class="preview-version">v{previewVersion}</span>
          {/if}
          <span class="preview-base">{previewBaseUrl}</span>
        </div>
        <div class="preview-actions">
          <button class="btn btn-toggle-all" onclick={toggleAll}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
          <button
            class="btn btn-import"
            onclick={handleImport}
            disabled={importing || noneSelected}
          >
            {importing ? 'Importing...' : `Import ${selectedCount} endpoint${selectedCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>

      <div class="endpoint-list">
        {#each previewEndpoints as ep, i}
          <button
            class="endpoint-row"
            class:deselected={!ep.selected}
            onclick={() => toggleEndpoint(i)}
          >
            <span class="endpoint-check">{ep.selected ? '\u2611' : '\u2610'}</span>
            <span class="endpoint-method" style="color: {methodColor(ep.method)}">{ep.method.toUpperCase()}</span>
            <span class="endpoint-path">{ep.path}</span>
            {#if ep.summary}
              <span class="endpoint-summary">{ep.summary}</span>
            {/if}
            {#each ep.tags as tag}
              <span class="endpoint-tag">{tag}</span>
            {/each}
          </button>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Imported Tools Registry -->
  {#if specGroups.length > 0}
    <section class="registry-section">
      <h2 class="section-heading">Imported Tools</h2>

      {#each specGroups as group}
        {@const isNewlyImported = group.specId === newlyImportedSpecId}
        <div class="spec-group" class:newly-imported={isNewlyImported}>
          <div class="spec-group-header" role="button" tabindex="0" onclick={() => toggleGroup(group.specId)} onkeydown={(e) => { if (e.key === 'Enter') toggleGroup(group.specId); }}>
            <div class="spec-group-meta">
              <span class="spec-group-title">{group.specTitle}</span>
              {#if group.specVersion}
                <span class="spec-group-version">v{group.specVersion}</span>
              {/if}
              <span class="spec-group-count">{group.endpoints.length} endpoint{group.endpoints.length === 1 ? '' : 's'}</span>
              {#if isNewlyImported}
                <span class="new-badge">Newly imported</span>
              {/if}
            </div>
            <div class="spec-group-actions">
              <button
                class="btn btn-remove"
                onclick={(e) => { e.stopPropagation(); handleDeleteSpec(group.specId); }}
              >
                Remove
              </button>
              <span class="expand-icon">{group.expanded || isNewlyImported ? '\u25BC' : '\u25B6'}</span>
            </div>
          </div>

          {#if group.expanded || isNewlyImported}
            <div class="spec-group-body">
              {#each group.endpoints as entry}
                <div class="registry-row" class:disabled-row={!entry.isEnabled}>
                  <span class="endpoint-method" style="color: {methodColor(entry.method)}">{entry.method.toUpperCase()}</span>
                  <span class="endpoint-path">{entry.path}</span>
                  {#if entry.summary}
                    <span class="endpoint-summary">{entry.summary}</span>
                  {/if}
                  <button
                    class="btn btn-toggle-endpoint"
                    onclick={() => handleToggleEndpoint(entry.id, entry.isEnabled)}
                  >
                    {entry.isEnabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </section>
  {/if}
</div>

<style>
  .import-page {
    padding: var(--space-2xl) var(--space-xl);
    max-width: 960px;
  }

  .banner {
    margin-bottom: var(--space-lg);
    padding: var(--space-md) var(--space-lg);
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    background: var(--card);
    line-height: 1.5;
  }

  .banner-success {
    border: 1px solid var(--success, #2DD4BF);
    color: var(--success, #2DD4BF);
  }

  .banner-error {
    border: 1px solid var(--error);
    color: var(--error);
  }

  /* ── Section headings ──────────────────────────────────── */

  .section-heading {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 600;
    color: var(--text);
    margin: 0 0 var(--space-xs) 0;
    line-height: 1.2;
  }

  .section-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0 0 var(--space-lg) 0;
    line-height: 1.5;
  }

  /* ── Import form ───────────────────────────────────────── */

  .import-section {
    margin-bottom: var(--space-2xl);
  }

  .import-form {
    display: flex;
    gap: var(--space-sm);
  }

  .spec-input {
    flex: 1;
    min-height: 44px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0 var(--space-lg);
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    outline: none;
    transition: border-color 0.15s ease;
  }

  .spec-input::placeholder {
    color: var(--text-muted);
    opacity: 0.6;
  }

  .spec-input:focus {
    border-color: var(--accent);
  }

  .spec-input:disabled {
    opacity: 0.5;
  }

  /* ── Buttons ───────────────────────────────────────────── */

  .btn {
    min-height: 44px;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 400;
    background: transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background 0.15s ease, opacity 0.15s ease;
    padding: 0 var(--space-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-preview {
    border: 1px solid var(--accent);
    color: var(--accent);
  }

  .btn-preview:hover:not(:disabled) {
    background: var(--accent-dim);
  }

  .btn-import {
    border: 1px solid var(--rose, #F472B6);
    color: var(--rose, #F472B6);
  }

  .btn-import:hover:not(:disabled) {
    background: rgba(244, 114, 182, 0.08);
  }

  .btn-toggle-all {
    border: 1px solid var(--border);
    color: var(--text-muted);
    min-height: 36px;
    font-size: 12px;
  }

  .btn-toggle-all:hover {
    border-color: var(--accent);
    color: var(--text);
  }

  .btn-remove {
    border: 1px solid var(--error);
    color: var(--error);
    min-height: 32px;
    font-size: 12px;
    padding: 0 var(--space-md);
  }

  .btn-remove:hover {
    background: var(--error-dim);
  }

  .btn-toggle-endpoint {
    border: 1px solid var(--border);
    color: var(--text-muted);
    min-height: 28px;
    font-size: 11px;
    padding: 0 var(--space-sm);
    margin-left: auto;
    flex-shrink: 0;
  }

  .btn-toggle-endpoint:hover {
    border-color: var(--accent);
    color: var(--text);
  }

  /* ── Preview panel ─────────────────────────────────────── */

  .preview-section {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-2xl);
    overflow: hidden;
  }

  .preview-header {
    padding: var(--space-lg);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-md);
  }

  .preview-meta {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .preview-title {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
    margin: 0;
  }

  .preview-version {
    font-family: var(--font-label);
    font-size: 6px;
    color: var(--accent);
    letter-spacing: 0.08em;
  }

  .preview-base {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  .preview-actions {
    display: flex;
    gap: var(--space-sm);
  }

  .endpoint-list {
    max-height: 440px;
    overflow-y: auto;
  }

  .endpoint-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    text-align: left;
    transition: background 0.1s ease;
    border-bottom: 1px solid var(--border);
  }

  .endpoint-row:last-child {
    border-bottom: none;
  }

  .endpoint-row:hover {
    background: var(--accent-dim);
  }

  .endpoint-row.deselected {
    opacity: 0.4;
  }

  .endpoint-check {
    font-size: 16px;
    color: var(--accent);
    flex-shrink: 0;
    width: 20px;
  }

  .endpoint-method {
    font-family: var(--font-label);
    font-size: 7px;
    letter-spacing: 0.06em;
    flex-shrink: 0;
    width: 52px;
    text-align: left;
  }

  .endpoint-path {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text);
    flex-shrink: 0;
  }

  .endpoint-summary {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: var(--space-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .endpoint-tag {
    font-family: var(--font-label);
    font-size: 6px;
    color: var(--text-muted);
    background: var(--accent-dim);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  /* ── Registry list ─────────────────────────────────────── */

  .registry-section {
    margin-bottom: var(--space-2xl);
  }

  .registry-section .section-heading {
    margin-bottom: var(--space-lg);
  }

  .spec-group {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-md);
    overflow: hidden;
  }

  .spec-group-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: var(--font-body);
    color: var(--text);
    text-align: left;
    transition: background 0.1s ease;
  }

  .spec-group-header:hover {
    background: var(--accent-dim);
  }

  .spec-group-meta {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }

  .spec-group-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--text);
  }

  .spec-group-version {
    font-family: var(--font-label);
    font-size: 6px;
    color: var(--accent);
    letter-spacing: 0.08em;
  }

  .spec-group-count {
    font-size: 12px;
    color: var(--text-muted);
  }

  .spec-group-actions {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }

  .expand-icon {
    font-size: 10px;
    color: var(--text-muted);
  }

  .spec-group-body {
    border-top: 1px solid var(--border);
  }

  .registry-row {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    border-bottom: 1px solid var(--border);
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
  }

  .registry-row:last-child {
    border-bottom: none;
  }

  .registry-row.disabled-row {
    opacity: 0.4;
  }

  .spec-group.newly-imported {
    border-color: var(--teal, #2DD4BF);
    box-shadow: 0 0 0 1px rgba(45, 212, 191, 0.2);
  }

  .new-badge {
    font-family: var(--font-label);
    font-size: 7px;
    color: var(--teal, #2DD4BF);
    background: rgba(45, 212, 191, 0.1);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
