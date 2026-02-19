<script lang="ts">
  import { signIn } from '@auth/sveltekit/client';
</script>

<svelte:head>
  <title>Sign In | Claw Army</title>
</svelte:head>

<div class="login-wrap">
  <div class="login-card">
    <div class="brand">
      <svg width="28" height="28" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 1.5L17.5 5.75V14.25L10 18.5L2.5 14.25V5.75L10 1.5Z"
          stroke="#3d7eff" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
        <circle cx="10" cy="10" r="3" fill="#3d7eff"/>
      </svg>
      <span class="brand-name">Claw Army</span>
    </div>

    <h1>Sign in to deploy</h1>
    <p class="sub">Authenticate with Google to launch bot crews and monitor executions.</p>

    <button
      class="google-btn"
      onclick={() => signIn('google', { redirectTo: '/new-execution' })}
    >
      <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Sign in with Google
    </button>
  </div>
</div>

<style>
  .login-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 52px);
    padding: var(--s-8) var(--s-6);
  }

  .login-card {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding: var(--s-8) var(--s-8);
    max-width: 380px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-4);
    text-align: center;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    margin-bottom: var(--s-2);
  }

  .brand-name {
    font-weight: 700;
    font-size: 0.875rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-primary);
  }

  h1 {
    font-size: 1.375rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin: 0;
  }

  .sub {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--s-3);
    width: 100%;
    padding: 0.75rem var(--s-5);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    color: var(--text-primary);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    margin-top: var(--s-2);
  }

  .google-btn:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: var(--surface-3);
  }

  .google-icon {
    flex-shrink: 0;
  }
</style>
