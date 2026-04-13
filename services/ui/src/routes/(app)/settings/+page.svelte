<script lang="ts">
  import type { PageData } from './$types';
  import { handleApiError } from '$lib/handle-api-error';
  import { success } from '$lib/toast-store';

  let { data }: { data: PageData } = $props();

  let profile = $derived(data.profile);
  let apiKeys = $derived(data.apiKeys ?? []);
  let savedPrefs = $derived(data.preferences);

  let prefs = $state({
    inAppEvolutionEvents: savedPrefs?.inAppEvolutionEvents ?? true,
    inAppBudgetAlerts: savedPrefs?.inAppBudgetAlerts ?? true,
    inAppSkillEvents: savedPrefs?.inAppSkillEvents ?? true,
    budgetAlertThreshold50: savedPrefs?.budgetAlertThreshold50 ?? true,
    budgetAlertThreshold75: savedPrefs?.budgetAlertThreshold75 ?? true,
    budgetAlertThreshold90: savedPrefs?.budgetAlertThreshold90 ?? true,
  });

  let prefsDirty = $derived(
    prefs.inAppEvolutionEvents !== (savedPrefs?.inAppEvolutionEvents ?? true) ||
    prefs.inAppBudgetAlerts !== (savedPrefs?.inAppBudgetAlerts ?? true) ||
    prefs.inAppSkillEvents !== (savedPrefs?.inAppSkillEvents ?? true) ||
    prefs.budgetAlertThreshold50 !== (savedPrefs?.budgetAlertThreshold50 ?? true) ||
    prefs.budgetAlertThreshold75 !== (savedPrefs?.budgetAlertThreshold75 ?? true) ||
    prefs.budgetAlertThreshold90 !== (savedPrefs?.budgetAlertThreshold90 ?? true)
  );

  let prefsSaving = $state(false);
  let prefsMsg = $state('');

  let newKeyName = $state('');
  let keyCreating = $state(false);
  let newKey = $state<{ id: string; key: string; keyPrefix: string; name: string } | null>(null);
  let newKeyValue = $derived(newKey?.key ?? '');
  let keyError = $state('');

  let deleteConfirmName = $state('');
  let deleteStep = $state<'idle' | 'confirm' | 'deleting'>('idle');

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function savePrefs() {
    prefsSaving = true;
    prefsMsg = '';
    try {
      const res = await fetch('/api/akasa/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) {
        await handleApiError(null, res, { message: 'Failed to save preferences' });
        return;
      }
      success('Preferences saved');
    } catch (err) {
      await handleApiError(err, undefined, { suppressToast: true });
      prefsMsg = 'Failed to save preferences';
    } finally {
      prefsSaving = false;
    }
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
      success('API key revoked');
    } catch (err) {
      await handleApiError(err);
    }
  }

  async function deleteAccount() {
    if (deleteConfirmName !== profile?.name) return;
    deleteStep = 'deleting';
    try {
      const res = await fetch('/api/akasa/settings/account', { method: 'DELETE' });
      if (!res.ok) {
        await handleApiError(null, res, { message: 'Failed to delete account' });
        deleteStep = 'confirm';
        return;
      }
      window.location.href = '/auth';
    } catch (err) {
      await handleApiError(err);
      deleteStep = 'confirm';
    }
  }
</script>

<div class="settings-page">
  <header class="page-header section">
    <h1 class="page-title">Settings</h1>
  </header>

  <section class="section" aria-label="Profile">
    <h2 class="section-heading">Profile</h2>
    {#if profile}
      <div class="profile-card">
        <div class="avatar-row">
          {#if profile.image}
            <img class="avatar" src={profile.image} alt={profile.name} />
          {:else}
            <div class="avatar avatar-placeholder">{profile.name?.charAt(0)?.toUpperCase() ?? '?'}</div>
          {/if}
          <div class="profile-info">
            <div class="profile-name">{profile.name}</div>
            <div class="profile-email">{profile.email}</div>
            <span class="profile-badge">Google OAuth</span>
          </div>
        </div>
      </div>
    {:else}
      <p class="empty-state">Profile information unavailable.</p>
    {/if}
  </section>

  <section class="section" aria-label="Notifications">
    <h2 class="section-heading">Notifications</h2>
    <p class="section-sub">In-app notifications for MVP. Email and Slack coming soon.</p>

    <div class="toggle-list">
      <div class="toggle-row">
        <div class="toggle-label">
          <span class="toggle-name">Evolution events</span>
          <span class="toggle-desc">Verdicts, promotions, DNA captures</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" bind:checked={prefs.inAppEvolutionEvents} />
          <span class="toggle-track"></span>
        </label>
      </div>

      <div class="toggle-row">
        <div class="toggle-label">
          <span class="toggle-name">Skill events</span>
          <span class="toggle-desc">Learned and unlearned skills</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" bind:checked={prefs.inAppSkillEvents} />
          <span class="toggle-track"></span>
        </label>
      </div>

      <div class="toggle-row">
        <div class="toggle-label">
          <span class="toggle-name">Budget alerts</span>
          <span class="toggle-desc">Spending threshold warnings</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" bind:checked={prefs.inAppBudgetAlerts} />
          <span class="toggle-track"></span>
        </label>
      </div>
    </div>

    {#if prefs.inAppBudgetAlerts}
      <div class="threshold-list">
        <span class="threshold-label">Alert thresholds:</span>
        <label class="toggle-switch threshold">
          <input type="checkbox" bind:checked={prefs.budgetAlertThreshold50} />
          <span class="toggle-track"></span>
          <span class="threshold-val">50%</span>
        </label>
        <label class="toggle-switch threshold">
          <input type="checkbox" bind:checked={prefs.budgetAlertThreshold75} />
          <span class="toggle-track"></span>
          <span class="threshold-val">75%</span>
        </label>
        <label class="toggle-switch threshold">
          <input type="checkbox" bind:checked={prefs.budgetAlertThreshold90} />
          <span class="toggle-track"></span>
          <span class="threshold-val">90%</span>
        </label>
      </div>
    {/if}

    <div class="save-row">
      <button class="btn-primary" onclick={savePrefs} disabled={!prefsDirty || prefsSaving}>
        {prefsSaving ? 'Saving...' : 'Save preferences'}
      </button>
      {#if prefsMsg}<span class="save-msg">{prefsMsg}</span>{/if}
    </div>
  </section>

  <section class="section" aria-label="API Keys">
    <h2 class="section-heading">API Keys</h2>
    <p class="section-sub">Generate keys for programmatic access to Akasa.</p>

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
        <div class="key-new-label">New API key — copy and save it now, you won't see it again:</div>
        <div class="key-new-row">
          <code class="key-new-value">{newKey.key}</code>
          <button class="btn-copy" onclick={() => { navigator.clipboard.writeText(newKeyValue); }}>Copy</button>
        </div>
      </div>
    {/if}

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
            <button class="btn-revoke" onclick={() => revokeKey(key.id)}>Revoke</button>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="section danger-section" aria-label="Danger Zone">
    <h2 class="section-heading danger-heading">Danger Zone</h2>

    <div class="danger-card">
      <div class="danger-row">
        <div class="danger-info">
          <span class="danger-action">Delete account</span>
          <span class="danger-desc">Permanently remove your account and all associated data. This cannot be undone.</span>
        </div>
        {#if deleteStep === 'idle'}
          <button class="btn-danger" onclick={() => { deleteStep = 'confirm'; }}>Delete account</button>
        {:else if deleteStep === 'confirm'}
          <div class="delete-confirm">
            <p class="delete-warn">Type <strong>{profile?.name}</strong> to confirm:</p>
            <input class="delete-input" type="text" bind:value={deleteConfirmName} placeholder={profile?.name} />
            <div class="delete-btns">
              <button class="btn-danger" onclick={deleteAccount} disabled={deleteConfirmName !== profile?.name || deleteStep === 'deleting'}>
                {deleteStep === 'deleting' ? 'Deleting...' : 'Confirm delete'}
              </button>
              <button class="btn-ghost" onclick={() => { deleteStep = 'idle'; deleteConfirmName = ''; }}>Cancel</button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </section>
</div>

<style>
  .settings-page {
    width: 100%;
  }

  .page-header {
    padding-bottom: var(--space-md);
  }

  .page-title {
    font-family: var(--font-display);
    font-size: clamp(26px, 3.5vw, 38px);
    font-weight: 600;
    color: var(--ink);
    line-height: 1.1;
    margin: 0;
  }

  :global(body.back-office) .page-title {
    color: var(--bo-text);
  }

  .section {
    padding: 28px 40px;
    border-bottom: 1px solid var(--fo-border, #E8E4DC);
  }

  :global(body.back-office) .section {
    border-bottom-color: rgba(124, 58, 237, 0.13);
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--ink);
    margin: 0 0 var(--space-lg) 0;
  }

  :global(body.back-office) .section-heading {
    color: var(--bo-text);
  }

  .section-sub {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: -12px 0 20px 0;
  }

  /* Profile */
  .profile-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 20px 24px;
  }

  .avatar-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .avatar-placeholder {
    background: var(--accent);
    color: #fff;
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .profile-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .profile-name {
    font-family: var(--font-body);
    font-size: 15px;
    font-weight: 500;
    color: var(--text);
  }

  .profile-email {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
  }

  .profile-badge {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.08em;
    color: var(--muted);
    text-transform: uppercase;
    margin-top: 2px;
  }

  /* Notifications */
  .toggle-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-bottom: 20px;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .toggle-label {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .toggle-name {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text);
  }

  .toggle-desc {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
  }

  .toggle-switch {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .toggle-switch input {
    display: none;
  }

  .toggle-track {
    width: 34px;
    height: 18px;
    background: var(--border);
    border-radius: 9px;
    position: relative;
    transition: background 0.2s;
  }

  .toggle-track::after {
    content: '';
    position: absolute;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: #fff;
    top: 2.5px;
    left: 2.5px;
    transition: transform 0.2s;
  }

  .toggle-switch input:checked + .toggle-track {
    background: var(--accent);
  }

  .toggle-switch input:checked + .toggle-track::after {
    transform: translateX(16px);
  }

  .threshold-list {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
    background: var(--bg2);
    border-radius: var(--radius-sm);
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .threshold-label {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
  }

  .toggle-switch.threshold {
    gap: 6px;
  }

  .threshold-val {
    font-family: var(--font-label);
    font-size: 7px;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .save-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .save-msg {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--accent);
  }

  /* API Keys */
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

  :global(body.back-office) .key-input {
    background: var(--d-card);
    color: var(--d-text);
  }

  .key-error {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--danger);
    margin: 0 0 12px 0;
  }

  .key-new {
    background: var(--accent-dim);
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

  .key-error {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--danger);
  }

  .empty-state {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }

  /* Buttons */
  .btn-primary {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: #fff;
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
    color: #fff;
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
    color: #fff;
  }

  /* Danger Zone */
  .danger-section {
    border-bottom: none;
  }

  .danger-heading {
    color: var(--danger);
  }

  .danger-card {
    background: var(--card);
    border: 1px solid var(--danger);
    border-radius: var(--radius-md);
    padding: 20px 24px;
    opacity: 0.85;
  }

  .danger-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
  }

  .danger-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 200px;
  }

  .danger-action {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    color: var(--danger);
  }

  .danger-desc {
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--muted);
    line-height: 1.5;
  }

  .delete-confirm {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 240px;
  }

  .delete-warn {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .delete-input {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text);
    background: var(--card);
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    padding: 7px 12px;
    outline: none;
    width: 100%;
  }

  :global(body.back-office) .delete-input {
    background: var(--d-card);
    color: var(--d-text);
  }

  .delete-btns {
    display: flex;
    gap: 8px;
  }

  .btn-danger {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    background: var(--danger);
    border: 1px solid var(--danger);
    border-radius: var(--radius-sm);
    padding: 8px 16px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-danger:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-danger:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn-ghost {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px 16px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-ghost:hover {
    border-color: var(--text-muted);
  }
</style>
