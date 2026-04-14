<script lang="ts">
  import type { PageData } from './$types';
  import { handleApiError } from '$lib/handle-api-error';
  import { success } from '$lib/toast-store';

  let { data }: { data: PageData } = $props();

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
</script>

<div class="preferences-page">
  <header class="page-header">
    <h2 class="page-title">Preferences</h2>
    <p class="page-desc">Notification settings and alert thresholds.</p>
  </header>

  <section class="section" aria-label="Notifications">
    <h3 class="section-heading">Notifications</h3>
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
</div>

<style>
  .preferences-page {
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

  .section-sub {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    margin: -8px 0 20px 0;
  }

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

  @media (max-width: 768px) {
    .page-header {
      padding: 20px 16px 8px;
    }

    .section {
      padding: 16px 16px 24px;
    }
  }
</style>
