<script lang="ts">
  import { authClient } from '$lib/auth-client';

  let loading = $state(false);

  async function handleGoogleSignIn() {
    loading = true;
    await authClient.signIn.social({ provider: 'google', callbackURL: '/indra' });
  }
</script>

<svelte:head>
  <title>Sign In | Akasa</title>
</svelte:head>

<div class="login-wrap">
  <div class="login-card">
    <div class="brand">
      <div class="logo-mark">
        <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="lm-glow-login">
              <feGaussianBlur stdDeviation="1.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <g class="lm-outer">
            <polygon points="17,3 31,17 17,31 3,17" stroke="rgba(167,139,250,0.5)" stroke-width="1" fill="none"/>
          </g>
          <g class="lm-inner">
            <polygon points="17,8 26,17 17,26 8,17" stroke="rgba(167,139,250,0.35)" stroke-width="1" fill="rgba(124,58,237,0.08)"/>
          </g>
          <circle class="lm-core" cx="17" cy="17" r="2.5" fill="#a78bfa"/>
        </svg>
      </div>
      <span class="brand-name">Akasa</span>
    </div>

    <h1>Sign in to deploy</h1>
    <p class="sub">Authenticate with Google to launch bot crews and monitor executions.</p>

    <button
      class="google-btn"
      onclick={handleGoogleSignIn}
      disabled={loading}
    >
      <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      {loading ? 'Signing in...' : 'Sign in with Google'}
    </button>
  </div>
</div>

<style>
  .login-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 40px 24px;
  }

  .login-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 40px 36px;
    max-width: 380px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  /* Subtle violet top-edge highlight */
  .login-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(167,139,250,0.3), transparent);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }

  .logo-mark {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .logo-mark svg {
    width: 28px;
    height: 28px;
    overflow: visible;
  }

  .brand-name {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text);
  }

  h1 {
    font-family: var(--font-display);
    font-size: clamp(22px, 3vw, 26px);
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: var(--text);
    margin: 0;
  }

  .sub {
    font-size: 14px;
    font-weight: 300;
    color: var(--text-muted);
    line-height: 1.65;
    margin: 0;
  }

  .google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    padding: 13px 24px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 400;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    margin-top: 4px;
  }

  .google-btn:hover:not(:disabled) {
    border-color: var(--border);
    background: var(--bg2);
  }

  .google-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .google-icon {
    flex-shrink: 0;
  }
</style>
