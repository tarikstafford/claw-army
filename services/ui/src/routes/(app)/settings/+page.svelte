<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let user = $derived(data.user);
  let preferences = $derived(data.preferences);
  let apiKeys = $derived(data.apiKeys);
  let userId = $derived(data.userId);

  let displayName = $state(data.preferences?.displayName ?? user.name ?? '');
  let evolutionEvents = $state(data.preferences?.evolutionEvents === 'true');
  let budgetAlerts = $state(data.preferences?.budgetAlerts === 'true');
  let skillEvents = $state(data.preferences?.skillEvents === 'true');

  let newKeyName = $state('');
  let createdKey = $state<string | null>(null);
  let copySuccess = $state(false);
  let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  let revokingId = $state<string | null>(null);

  async function savePreferences() {
    saveStatus = 'saving';
    try {
      const res = await fetch(`/api/akasa/user-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          displayName,
          evolutionEvents,
          budgetAlerts,
          skillEvents,
        }),
      });
      if (res.ok) {
        saveStatus = 'saved';
        setTimeout(() => { saveStatus = 'idle'; }, 2000);
      } else {
        saveStatus = 'error';
      }
    } catch {
      saveStatus = 'error';
    }
  }

  async function generateApiKey() {
    if (!newKeyName.trim()) return;
    try {
      const res = await fetch(`/api/akasa/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: newKeyName }),
      });
      if (res.ok) {
        const key = await res.json();
        createdKey = key.raw;
        newKeyName = '';
        apiKeys = [key, ...apiKeys];
      }
    } catch {
      // error
    }
  }

  async function revokeApiKey(id: string) {
    revokingId = id;
    try {
      const res = await fetch(`/api/akasa/api-keys/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        apiKeys = apiKeys.filter(k => k.id !== id);
      }
    } catch {
      // error
    } finally {
      revokingId = null;
    }
  }

  function copyKey() {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey).then(() => {
      copySuccess = true;
      setTimeout(() => { copySuccess = false; }, 2000);
    });
  }

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<div class="settings-page">
  <header class="page-header section">
    <h1 class="page-title">Settings</h1>
  </header>

  <!-- Profile Section -->
  <section class="section" aria-label="Profile">
    <h2 class="section-heading">Profile</h2>
    <div class="profile-card">
      {#if user.image}
        <img src={user.image} alt="Avatar" class="avatar" />
      {:else}
        <div class="avatar-placeholder">
          {(user.name ?? user.email ?? '?')[0]?.toUpperCase()}
        </div>
      {/if}
      <div class="profile-info">
        <div class="field">
          <label class="field-label" for="display-name">Display name</label>
          <input
            id="display-name"
            type="text"
            class="field-input"
            bind:value={displayName}
            placeholder="Your display name"
          />
        </div>
        <div class="field">
          <label class="field-label" for="email">Email</label>
          <input
            id="email"
            type="email"
            class="field-input"
            value={user.email}
            readonly
          />
          <span class="field-hint">Email is managed via Google OAuth</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Notifications Section -->
  <section class="section" aria-label="Notifications">
    <h2 class="section-heading">Notifications</h2>
    <div class="notifications-card">
      <div class="toggle-row">
        <div class="toggle-info">
          <span class="toggle-label">Evolution events</span>
          <span class="toggle-desc">Verdicts, promotions, DNA captures</span>
        </div>
        <button
          class="toggle"
          class:active={evolutionEvents}
          onclick={() => { evolutionEvents = !evolutionEvents; }}
          role="switch"
          aria-checked={evolutionEvents}
        >
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <span class="toggle-label">Budget alerts</span>
          <span class="toggle-desc">50%, 75%, 90% thresholds</span>
        </div>
        <button
          class="toggle"
          class:active={budgetAlerts}
          onclick={() => { budgetAlerts = !budgetAlerts; }}
          role="switch"
          aria-checked={budgetAlerts}
        >
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="toggle-row">
        <div class="toggle-info">
          <span class="toggle-label">Skill events</span>
          <span class="toggle-desc">Learned, unlearned</span>
        </div>
        <button
          class="toggle"
          class:active={skillEvents}
          onclick={() => { skillEvents = !skillEvents; }}
          role="switch"
          aria-checked={skillEvents}
        >
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="save-row">
        <button
          class="save-btn"
          onclick={savePreferences}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save preferences'}
        </button>
      </div>
    </div>
  </section>

  <!-- API Keys Section -->
  <section class="section" aria-label="API Keys">
    <h2 class="section-heading">API Keys</h2>
    <div class="api-keys-card">
      <div class="new-key-row">
        <input
          type="text"
          class="field-input"
          placeholder="Key name (e.g. Production, Dev)"
          bind:value={newKeyName}
        />
        <button class="create-key-btn" onclick={generateApiKey} disabled={!newKeyName.trim()}>
          Generate
        </button>
      </div>

      {#if createdKey}
        <div class="key-created-banner">
          <div class="key-created-info">
            <span class="key-created-label">New API key created. Copy it now — you won't see it again.</span>
            <code class="key-created-value">{createdKey}</code>
          </div>
          <button class="copy-btn" onclick={copyKey}>
            {copySuccess ? 'Copied!' : 'Copy'}
          </button>
        </div>
      {/if}

      {#if apiKeys.length === 0}
        <p class="empty-state">No API keys yet. Generate one above to access Akasa programmatically.</p>
      {:else}
        <div class="keys-list">
          {#each apiKeys as key (key.id)}
            <div class="key-row">
              <div class="key-info">
                <span class="key-name">{key.name}</span>
                <span class="key-meta">
                  {key.keyPrefix}... • Created {formatDate(key.createdAt)} • Last used {formatDate(key.lastUsedAt)}
                </span>
              </div>
              <button
                class="revoke-btn"
                onclick={() => revokeApiKey(key.id)}
                disabled={revokingId === key.id}
              >
                {revokingId === key.id ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </section>

  <!-- Danger Zone -->
  <section class="section danger-section" aria-label="Danger Zone">
    <h2 class="section-heading danger-heading">Danger Zone</h2>
    <div class="danger-card">
      <div class="danger-row">
        <div class="danger-info">
          <span class="danger-label">Delete account</span>
          <span class="danger-desc">Permanently delete your account and all associated data. This cannot be undone.</span>
        </div>
        <button class="danger-btn">Delete account</button>
      </div>
      <div class="danger-row">
        <div class="danger-info">
          <span class="danger-label">Export data</span>
          <span class="danger-desc">Download a copy of all your data in JSON format.</span>
        </div>
        <button class="export-btn">Export data</button>
      </div>
    </div>
  </section>
</div>

<style>
  .settings-page {
    width: 100%;
    max-width: 680px;
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
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    color: var(--ink);
    line-height: 1.2;
    margin: 0 0 var(--space-lg) 0;
  }

  :global(body.back-office) .section-heading {
    color: var(--bo-text);
  }

  /* Profile */
  .profile-card {
    display: flex;
    gap: var(--space-lg);
    align-items: flex-start;
  }

  .avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .avatar-placeholder {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--fo-plum);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 600;
    flex-shrink: 0;
  }

  :global(body.back-office) .avatar-placeholder {
    background: var(--bo-violet);
  }

  .profile-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  /* Fields */
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.10em;
    color: var(--muted);
    text-transform: uppercase;
  }

  .field-input {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink);
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-md);
    padding: 10px 12px;
    outline: none;
    transition: border-color 0.15s;
  }

  .field-input:focus {
    border-color: var(--fo-plum);
  }

  .field-input[readonly] {
    background: var(--fo-bg2);
    color: var(--muted);
    cursor: not-allowed;
  }

  :global(body.back-office) .field-input {
    background: var(--card);
    border-color: var(--border);
    color: var(--bo-text);
  }

  :global(body.back-office) .field-input:focus {
    border-color: var(--bo-violet);
  }

  :global(body.back-office) .field-input[readonly] {
    background: rgba(124, 58, 237, 0.08);
  }

  .field-hint {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
  }

  /* Notifications */
  .notifications-card {
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  :global(body.back-office) .notifications-card {
    background: var(--card);
    border-color: var(--border);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--fo-border);
  }

  :global(body.back-office) .toggle-row {
    border-bottom-color: var(--border);
  }

  .toggle-row:last-of-type {
    border-bottom: none;
  }

  .toggle-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toggle-label {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
  }

  :global(body.back-office) .toggle-label {
    color: var(--bo-text);
  }

  .toggle-desc {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
  }

  .toggle {
    position: relative;
    width: 44px;
    height: 24px;
    border-radius: 12px;
    background: var(--fo-border);
    border: none;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  :global(body.back-office) .toggle {
    background: rgba(124, 58, 237, 0.2);
  }

  .toggle.active {
    background: var(--fo-plum);
  }

  :global(body.back-office) .toggle.active {
    background: var(--bo-violet);
  }

  .toggle-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }

  .toggle.active .toggle-knob {
    transform: translateX(20px);
  }

  .save-row {
    padding: 16px 20px;
    border-top: 1px solid var(--fo-border);
  }

  :global(body.back-office) .save-row {
    border-top-color: var(--border);
  }

  .save-btn {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: #fff;
    background: var(--fo-plum);
    border: none;
    border-radius: var(--radius-md);
    padding: 10px 20px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .save-btn:hover:not(:disabled) {
    background: var(--fo-plum-dark);
  }

  .save-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global(body.back-office) .save-btn {
    background: var(--bo-violet);
  }

  :global(body.back-office) .save-btn:hover:not(:disabled) {
    background: var(--bo-violet-dark);
  }

  /* API Keys */
  .api-keys-card {
    background: var(--fo-card);
    border: 1px solid var(--fo-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  :global(body.back-office) .api-keys-card {
    background: var(--card);
    border-color: var(--border);
  }

  .new-key-row {
    display: flex;
    gap: var(--space-sm);
    padding: 16px 20px;
    border-bottom: 1px solid var(--fo-border);
  }

  :global(body.back-office) .new-key-row {
    border-bottom-color: var(--border);
  }

  .new-key-row .field-input {
    flex: 1;
  }

  .create-key-btn {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: #fff;
    background: var(--fo-teal);
    border: none;
    border-radius: var(--radius-md);
    padding: 10px 16px;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .create-key-btn:hover:not(:disabled) {
    background: var(--fo-teal-dark);
  }

  .create-key-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(body.back-office) .create-key-btn {
    background: var(--bo-teal);
  }

  :global(body.back-office) .create-key-btn:hover:not(:disabled) {
    background: var(--bo-teal-dark);
  }

  .key-created-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: 16px 20px;
    background: rgba(16, 185, 129, 0.08);
    border-bottom: 1px solid var(--fo-border);
  }

  :global(body.back-office) .key-created-banner {
    background: rgba(16, 185, 129, 0.12);
    border-bottom-color: var(--border);
  }

  .key-created-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .key-created-label {
    font-family: var(--font-body);
    font-size: 12px;
    color: #059669;
    font-weight: 500;
  }

  :global(body.back-office) .key-created-label {
    color: #10b981;
  }

  .key-created-value {
    font-family: monospace;
    font-size: 12px;
    color: var(--ink);
    word-break: break-all;
  }

  :global(body.back-office) .key-created-value {
    color: var(--bo-text);
  }

  .copy-btn {
    font-family: var(--font-label);
    font-size: 6px;
    letter-spacing: 0.10em;
    color: #fff;
    background: #059669;
    border: none;
    border-radius: var(--radius-md);
    padding: 8px 14px;
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .copy-btn:hover {
    background: #047857;
  }

  :global(body.back-office) .copy-btn {
    background: #10b981;
  }

  :global(body.back-office) .copy-btn:hover {
    background: #059669;
  }

  .empty-state {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
    padding: 24px 20px;
    line-height: 1.5;
  }

  .keys-list {
    display: flex;
    flex-direction: column;
  }

  .key-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    padding: 14px 20px;
    border-bottom: 1px solid var(--fo-border);
  }

  :global(body.back-office) .key-row {
    border-bottom-color: var(--border);
  }

  .key-row:last-child {
    border-bottom: none;
  }

  .key-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .key-name {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
  }

  :global(body.back-office) .key-name {
    color: var(--bo-text);
  }

  .key-meta {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
  }

  .revoke-btn {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.08em;
    color: var(--rose);
    background: transparent;
    border: 1px solid var(--rose);
    border-radius: var(--radius-md);
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .revoke-btn:hover:not(:disabled) {
    background: rgba(244, 114, 182, 0.1);
  }

  .revoke-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Danger Zone */
  .danger-section {
    border-top: 1px solid var(--fo-border);
  }

  :global(body.back-office) .danger-section {
    border-top-color: var(--border);
  }

  .danger-heading {
    color: var(--rose);
  }

  .danger-card {
    background: var(--fo-card);
    border: 1px solid rgba(244, 114, 182, 0.3);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  :global(body.back-office) .danger-card {
    background: var(--card);
    border-color: rgba(244, 114, 182, 0.3);
  }

  .danger-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-lg);
    padding: 18px 20px;
    border-bottom: 1px solid rgba(244, 114, 182, 0.2);
  }

  .danger-row:last-child {
    border-bottom: none;
  }

  .danger-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .danger-label {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
  }

  :global(body.back-office) .danger-label {
    color: var(--bo-text);
  }

  .danger-desc {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--muted);
    max-width: 400px;
  }

  .danger-btn {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.08em;
    color: var(--rose);
    background: transparent;
    border: 1px solid var(--rose);
    border-radius: var(--radius-md);
    padding: 8px 14px;
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .danger-btn:hover {
    background: rgba(244, 114, 182, 0.1);
  }

  .export-btn {
    font-family: var(--font-label);
    font-size: 5px;
    letter-spacing: 0.08em;
    color: var(--bo-violet);
    background: transparent;
    border: 1px solid var(--bo-violet);
    border-radius: var(--radius-md);
    padding: 8px 14px;
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .export-btn:hover {
    background: rgba(124, 58, 237, 0.1);
  }
</style>
