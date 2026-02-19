<script lang="ts">
  import { browser } from '$app/environment';
  import { listAllExecutions, stopExecution, type AdminExecution } from '$lib/api';

  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? 'admin';

  let authenticated = $state(false);
  let passwordInput = $state('');
  let authError = $state(false);

  let executions = $state<AdminExecution[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let stoppingId = $state<string | null>(null);
  let confirmStopId = $state<string | null>(null);

  $effect(() => {
    if (!browser) return;
    authenticated = sessionStorage.getItem('admin_auth') === 'true';
  });

  function login() {
    if (passwordInput === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', 'true');
      authenticated = true;
      authError = false;
    } else {
      authError = true;
    }
  }

  function logout() {
    sessionStorage.removeItem('admin_auth');
    authenticated = false;
  }

  async function loadData() {
    try {
      executions = await listAllExecutions();
      error = null;
    } catch (err) {
      error = (err as Error).message;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (!browser || !authenticated) return;
    loadData();
    const interval = setInterval(loadData, 10_000);
    return () => clearInterval(interval);
  });

  async function confirmStop(id: string) {
    confirmStopId = id;
  }

  async function doStop() {
    if (!confirmStopId) return;
    const id = confirmStopId;
    confirmStopId = null;
    stoppingId = id;
    try {
      await stopExecution(id);
      await loadData();
    } catch (err) {
      error = `Failed to stop execution: ${(err as Error).message}`;
    } finally {
      stoppingId = null;
    }
  }

  // Derived stats
  let totalExecutions = $derived(executions.length);
  let runningNow = $derived(executions.filter(e => e.status === 'running').length);
  let totalFailed = $derived(executions.filter(e => e.status === 'failed').length);
  let totalBudgetCents = $derived(executions.reduce((sum, e) => sum + e.budgetCapCents, 0));

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function truncate(str: string, n = 70) {
    return str.length > n ? str.slice(0, n) + '…' : str;
  }
</script>

<svelte:head>
  <title>Admin | Claw Army</title>
</svelte:head>

{#if !authenticated}
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-icon">🔐</div>
      <h1>Admin Access</h1>
      <p>Enter the admin password to continue.</p>
      <form onsubmit={(e) => { e.preventDefault(); login(); }}>
        <input
          type="password"
          placeholder="Password"
          bind:value={passwordInput}
          class:input-error={authError}
          autocomplete="current-password"
        />
        {#if authError}
          <p class="error-msg">Incorrect password.</p>
        {/if}
        <button type="submit">Sign In</button>
      </form>
    </div>
  </div>
{:else}
  <div class="page">
    <div class="page-header">
      <div>
        <h1>Admin Dashboard</h1>
        <p class="subtitle">All executions across the system. Refreshes every 10s.</p>
      </div>
      <button class="logout-btn" onclick={logout}>Sign Out</button>
    </div>

    <!-- Stats bar -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Total Executions</span>
        <span class="stat-value">{totalExecutions}</span>
      </div>
      <div class="stat-card stat-running">
        <span class="stat-label">Running Now</span>
        <span class="stat-value">{runningNow}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Total Budget</span>
        <span class="stat-value">${(totalBudgetCents / 100).toFixed(2)}</span>
      </div>
      <div class="stat-card stat-failed">
        <span class="stat-label">Failed</span>
        <span class="stat-value">{totalFailed}</span>
      </div>
    </div>

    <!-- Executions table -->
    {#if loading}
      <div class="loading">Loading executions…</div>
    {:else if error}
      <div class="error-banner">{error}</div>
    {:else if executions.length === 0}
      <p class="empty">No executions yet.</p>
    {:else}
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Objective</th>
              <th>Status</th>
              <th>Bots</th>
              <th>Budget</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each executions as exec (exec.id)}
              <tr>
                <td class="col-objective">
                  <a href="/executions/{exec.id}">{truncate(exec.objective)}</a>
                </td>
                <td>
                  <span class="status status-{exec.status}">{exec.status}</span>
                </td>
                <td class="col-bots">
                  {exec.activeBotCount} / {exec.maxBots}
                </td>
                <td class="col-budget">
                  ${(exec.budgetCapCents / 100).toFixed(2)}
                </td>
                <td class="col-date">{formatDate(exec.createdAt)}</td>
                <td class="col-action">
                  {#if exec.status === 'running' || exec.status === 'queued'}
                    <button
                      class="stop-btn"
                      disabled={stoppingId === exec.id}
                      onclick={() => confirmStop(exec.id)}
                    >
                      {stoppingId === exec.id ? '…' : 'Stop'}
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- Confirm dialog -->
  {#if confirmStopId}
    <div class="overlay" role="dialog" aria-modal="true">
      <div class="dialog">
        <h2>Stop Execution?</h2>
        <p>This will terminate all running bots and mark the execution as stopped. This cannot be undone.</p>
        <div class="dialog-actions">
          <button class="cancel-btn" onclick={() => confirmStopId = null}>Cancel</button>
          <button class="confirm-stop-btn" onclick={doStop}>Yes, Stop It</button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* Login */
  .login-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
  }

  .login-card {
    background: var(--surface, #111827);
    border: 1px solid var(--border, #1f2937);
    border-radius: 0.75rem;
    padding: 2.5rem 2rem;
    width: 100%;
    max-width: 360px;
    text-align: center;
  }

  .login-icon {
    font-size: 2rem;
    margin-bottom: 0.75rem;
  }

  .login-card h1 {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
  }

  .login-card p {
    color: var(--text-secondary, #9ca3af);
    font-size: 0.875rem;
    margin: 0 0 1.5rem;
  }

  .login-card form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .login-card input {
    background: var(--bg, #0d1117);
    border: 1px solid var(--border, #1f2937);
    border-radius: 0.375rem;
    color: var(--text-primary, #f9fafb);
    font-size: 0.9rem;
    padding: 0.625rem 0.875rem;
    width: 100%;
    box-sizing: border-box;
  }

  .login-card input.input-error {
    border-color: #ef4444;
  }

  .login-card input:focus {
    outline: none;
    border-color: var(--signal, #3d7eff);
  }

  .error-msg {
    color: #ef4444;
    font-size: 0.8rem;
    margin: 0;
    text-align: left;
  }

  .login-card button[type="submit"] {
    background: var(--signal, #3d7eff);
    color: #fff;
    border: none;
    border-radius: 0.375rem;
    padding: 0.625rem;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }

  .login-card button[type="submit"]:hover {
    background: #5a8fff;
  }

  /* Page */
  .page {
    max-width: 1100px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    gap: 1rem;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin: 0 0 0.25rem;
  }

  .subtitle {
    color: var(--text-secondary, #9ca3af);
    font-size: 0.875rem;
    margin: 0;
  }

  .logout-btn {
    background: transparent;
    border: 1px solid var(--border, #1f2937);
    border-radius: 0.375rem;
    color: var(--text-secondary, #9ca3af);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0.375rem 0.75rem;
    white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
  }

  .logout-btn:hover {
    color: var(--text-primary, #f9fafb);
    border-color: var(--text-secondary, #9ca3af);
  }

  /* Stats */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  @media (max-width: 768px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .stat-card {
    background: var(--surface, #111827);
    border: 1px solid var(--border, #1f2937);
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: center;
  }

  .stat-card.stat-running {
    border-color: #1d4ed8;
    background: #0f172a;
  }

  .stat-card.stat-failed {
    border-color: #7f1d1d;
    background: #0f172a;
  }

  .stat-label {
    font-size: 0.7rem;
    color: var(--text-secondary, #9ca3af);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary, #f9fafb);
  }

  /* Table */
  .loading {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary, #9ca3af);
  }

  .error-banner {
    padding: 0.875rem 1rem;
    background: #1f0909;
    border: 1px solid #7f1d1d;
    border-radius: 0.5rem;
    color: #fca5a5;
    font-size: 0.875rem;
  }

  .empty {
    color: var(--text-secondary, #9ca3af);
    font-style: italic;
  }

  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border, #1f2937);
    border-radius: 0.5rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  thead th {
    text-align: left;
    padding: 0.75rem 1rem;
    background: var(--surface, #111827);
    border-bottom: 1px solid var(--border, #1f2937);
    font-weight: 600;
    color: var(--text-secondary, #9ca3af);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  tbody td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border, #1f2937);
    color: var(--text-primary, #f9fafb);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr:hover td {
    background: rgba(255, 255, 255, 0.02);
  }

  .col-objective {
    max-width: 380px;
  }

  .col-objective a {
    color: var(--signal, #3d7eff);
    text-decoration: none;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .col-objective a:hover {
    text-decoration: underline;
  }

  .col-bots {
    font-variant-numeric: tabular-nums;
    color: var(--text-secondary, #9ca3af);
  }

  .col-budget {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .col-date {
    white-space: nowrap;
    font-size: 0.8rem;
    color: var(--text-secondary, #9ca3af);
  }

  .col-action {
    text-align: right;
    width: 80px;
  }

  /* Status badges — matches billing page */
  .status {
    display: inline-block;
    padding: 0.2rem 0.55rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  .status-running  { color: #60a5fa; background: #0c1a2e; border: 1px solid #1d4ed8; }
  .status-queued   { color: #9ca3af; background: #111827; border: 1px solid #374151; }
  .status-completed{ color: #4ade80; background: #052e16; border: 1px solid #166534; }
  .status-failed   { color: #f87171; background: #1f0909; border: 1px solid #7f1d1d; }
  .status-stopped  { color: #fbbf24; background: #1a1100; border: 1px solid #92400e; }
  .status-paused   { color: #fbbf24; background: #1a1100; border: 1px solid #92400e; }

  /* Stop button */
  .stop-btn {
    background: transparent;
    border: 1px solid #7f1d1d;
    border-radius: 0.25rem;
    color: #f87171;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.625rem;
    transition: background 0.15s;
  }

  .stop-btn:hover:not(:disabled) {
    background: #1f0909;
  }

  .stop-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Confirm dialog */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .dialog {
    background: var(--surface, #111827);
    border: 1px solid var(--border, #1f2937);
    border-radius: 0.75rem;
    padding: 2rem;
    max-width: 400px;
    width: 90%;
  }

  .dialog h2 {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0 0 0.75rem;
  }

  .dialog p {
    color: var(--text-secondary, #9ca3af);
    font-size: 0.875rem;
    margin: 0 0 1.5rem;
    line-height: 1.5;
  }

  .dialog-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .cancel-btn {
    background: transparent;
    border: 1px solid var(--border, #1f2937);
    border-radius: 0.375rem;
    color: var(--text-secondary, #9ca3af);
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    transition: color 0.15s;
  }

  .cancel-btn:hover {
    color: var(--text-primary, #f9fafb);
  }

  .confirm-stop-btn {
    background: #7f1d1d;
    border: none;
    border-radius: 0.375rem;
    color: #fca5a5;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.5rem 1rem;
    transition: background 0.15s;
  }

  .confirm-stop-btn:hover {
    background: #991b1b;
  }
</style>
