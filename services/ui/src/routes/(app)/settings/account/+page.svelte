<script lang="ts">
  import type { PageData } from './$types';
  import { handleApiError } from '$lib/handle-api-error';

  let { data }: { data: PageData } = $props();

  let profile = $derived(data.profile);

  let deleteConfirmName = $state('');
  let deleteStep = $state<'idle' | 'confirm' | 'deleting'>('idle');

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

<div class="account-page">
  <header class="page-header">
    <h2 class="page-title">Account</h2>
    <p class="page-desc">Profile information and account management.</p>
  </header>

  <section class="section" aria-label="Profile">
    <h3 class="section-heading">Profile</h3>
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

  <section class="section danger-section" aria-label="Danger Zone">
    <h3 class="section-heading danger-heading">Danger Zone</h3>

    <div class="danger-card">
      <div class="danger-row">
        <div class="danger-info">
          <span class="danger-action">Delete account</span>
          <span class="danger-desc">Permanently remove your account and all associated data. This cannot be undone.</span>
        </div>
        {#if deleteStep === 'idle'}
          <button class="btn-danger" onclick={() => { deleteStep = 'confirm'; }}>Delete account</button>
        {:else if deleteStep === 'confirm' || deleteStep === 'deleting'}
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
  .account-page {
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
    color: white;
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

  .empty-state {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }

  /* Danger Zone */
  .danger-section {
    margin-top: 24px;
    border-top: 1px solid var(--border);
    padding-top: 28px;
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

  .delete-btns {
    display: flex;
    gap: 8px;
  }

  .btn-danger {
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    color: white;
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

  @media (max-width: 768px) {
    .page-header {
      padding: 20px 16px 8px;
    }

    .section {
      padding: 16px 16px 24px;
    }

    .danger-section {
      padding-top: 24px;
    }
  }
</style>
