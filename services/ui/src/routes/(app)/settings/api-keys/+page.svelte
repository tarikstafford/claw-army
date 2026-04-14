<script lang="ts">
  import type { PageData } from './$types';
  import { handleApiError } from '$lib/handle-api-error';
  import { success } from '$lib/toast-store';

  let { data }: { data: PageData } = $props();

  let apiKeys = $derived(data.apiKeys ?? []);

  let newKeyName = $state('');
  let keyCreating = $state(false);
  let newKey = $state<{ id: string; key: string; keyPrefix: string; name: string } | null>(null);
  let newKeyValue = $derived(newKey?.key ?? '');
  let keyError = $state('');

  let revokeConfirmId = $state<string | null>(null);

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    keyCreating = true;
    keyError = '';
    newKey = null;
    try {
      const res = await fetch('/api/akasa/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) {
        await handleApiError(null, res, { message: 'Failed to create API key' });
        return;
      }
      const result = await res.json();
      newKey = result;
      newKeyName = '';
      success('API key created');
    } catch (err) {
      await handleApiError(err, undefined, { suppressToast: true });
      keyError = 'Failed to create API key';
    } finally {
      keyCreating = false;
    }
  }

  async function revokeKey(id: string) {
    try {
      const res = await fetch(`/api/akasa/settings/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        await handleApiError(null, res, { message: 'Failed to revoke API key' });
        return;
      }
      apiKeys = apiKeys.filter(k => k.id !== id);
      revokeConfirmId = null;
      success('API key revoked');
    } catch (err) {
      await handleApiError(err);
    }
  }
</script>

<div class="api-keys-page">
  <header class="page-header">
    <h2 class="page-title">API Keys</h2>
    <p class="page-desc">Generate keys for programmatic access to Akasa.</p>
  </header>

  <section class="section" aria-label="Create API Key">
    <div class="key-create">
      <input
        class="key-input"
        type="text"
        placeholder="Key name (e.g. CI pipeline)"
        bind:value={newKeyName}
        onkeydown={(e) => { if (e.key === 'Enter') createKey(); }}
      />
      <button class="btn-primary" onclick={createKey} disabled={!newKeyName.trim() || keyCreating}>
        {keyCreating ? 'Creating...' : 'Generate key'}
      </button>
    </div>
    {#if keyError}<p class="key-error">{keyError}</p>{/if}

    {#if newKey}
      <div class="key-new">
        <div class="key-new-label">New API key -- copy and save it now, you won't see it again:</div>
        <div class="key-new-row">
          <code class="key-new-value">{newKey.key}</code>
          <button class="btn-copy" onclick={() => { navigator.clipboard.writeText(newKeyValue); }}>Copy</button>
        </div>
      </div>
    {/if}
  </section>

  <section class="section" aria-label="Existing Keys">
    <h3 class="section-heading">Existing keys</h3>
    {#if apiKeys.length === 0}
      <p class="empty-state">No API keys yet. Generate one above.</p>
    {:else}
      <div class="key-list">
        {#each apiKeys as key (key.id)}
          <div class="key-row">
            <div class="key-info">
              <span class="key-name">{key.name}</span>
              <span class="key-meta">
                {key.keyPrefix}... &middot; Created {formatDate(key.createdAt)} &middot; Last used {formatDate(key.lastUsedAt)}
              </span>
            </div>
            {#if revokeConfirmId === key.id}
              <div class="revoke-confirm">
                <span class="revoke-text">Revoke?</span>
                <button class="btn-danger-sm" onclick={() => revokeKey(key.id)}>Yes</button>
                <button class="btn-ghost-sm" onclick={() => { revokeConfirmId = null; }}>No</button>
              </div>
            {:else}
              <button class="btn-revoke" onclick={() => { revokeConfirmId = key.id; }}>Revoke</button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .api-keys-page {
    width: 100%;
  }

  .page-header {
    padding: 28px 40px 12px;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 600;
    color: var(--ink, var(--text));
    margin: 0 0 4px 0;
  }

  .page-desc {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }

  .section {
    padding: 20px 40px 28px;
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--ink, var(--text));
    margin: 0 0 var(--space-md) 0;
  }

  .key-create {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
  }

  .key-input {
    flex: 1;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    outline: none;
    transition: border-color 0.2s;
  }

  .key-input:focus {
    border-color: var(--accent);
  }

  .key-error {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--danger);
    margin: 0 0 12px 0;
  }

  .key-new {
    background: var(--accent-dim, rgba(124, 58, 237, 0.06));
    border: 1px solid var(--accent);
    border-radius: var(--radius-md);
    padding: 16px 20px;
    margin-bottom: 20px;
  }

  .key-new-label {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--accent);
    margin-bottom: 10px;
  }

  .key-new-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .key-new-value {
    font-family: monospace;
    font-size: 12px;
    color: var(--text);
    background: var(--card);
    padding: 6px 10px;
    border-radius: 4px;
    word-break: break-all;
    flex: 1;
  }

  .key-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .key-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 18px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .key-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .key-name {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text);
    font-weight: 500;
  }

  .key-meta {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
  }

  .empty-state {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }

  .revoke-confirm {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .revoke-text {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--danger);
  }

  /* Buttons */
  .btn-primary {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: white;
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 8px 16px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-primary:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-copy {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    color: var(--accent);
    background: transparent;
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 5px 12px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-copy:hover {
    background: var(--accent);
    color: white;
  }

  .btn-revoke {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 500;
    color: var(--danger);
    background: transparent;
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    padding: 5px 12px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .btn-revoke:hover {
    background: var(--danger);
    color: white;
  }

  .btn-danger-sm {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 500;
    color: white;
    background: var(--danger);
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    padding: 4px 10px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-danger-sm:hover {
    opacity: 0.85;
  }

  .btn-ghost-sm {
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 4px 10px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-ghost-sm:hover {
    border-color: var(--text-muted);
  }

  @media (max-width: 768px) {
    .page-header {
      padding: 20px 16px 8px;
    }

    .section {
      padding: 16px 16px 24px;
    }

    .key-create {
      flex-direction: column;
    }
  }
</style>
