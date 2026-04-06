<script lang="ts">
  import { authClient } from '$lib/auth-client';

  let error = $state('');
  let loading = $state(false);

  async function handleGoogleSignIn() {
    loading = true;
    error = '';
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/onboarding' });
      if (result?.error) {
        error = result.error.message ?? 'Sign in failed. Please try again.';
        loading = false;
      }
    } catch (e) {
      error = (e as Error).message ?? 'Sign in failed. Please try again.';
      loading = false;
    }
  }
</script>

<div class="auth-page">
  <div class="auth-card">
    <div class="logo-area">
      <svg class="gem" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <polygon points="16,2 28,10 28,22 16,30 4,22 4,10" fill="none" stroke="var(--fo-plum)" stroke-width="1.5"/>
        <polygon points="16,2 28,10 16,16" fill="var(--fo-plum)" opacity="0.3"/>
        <polygon points="4,10 16,16 16,30" fill="var(--fo-plum)" opacity="0.15"/>
        <polygon points="28,10 16,16 28,22" fill="var(--fo-plum)" opacity="0.2"/>
      </svg>
      <span class="brand-name">Akasa</span>
    </div>

    <p class="tagline">Where agents build your business.</p>

    <button
      class="google-btn"
      onclick={handleGoogleSignIn}
      disabled={loading}
      type="button"
    >
      {#if loading}
        Signing in...
      {:else}
        Sign in with Google
      {/if}
    </button>

    {#if error}
      <p class="error-msg">{error}</p>
    {/if}
  </div>
</div>

<style>
  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--fo-bg, #F5F2EC);
    padding: 24px;
  }

  .auth-card {
    width: 360px;
    background: var(--fo-card, #FFFFFF);
    border: 1px solid var(--fo-border, #E8E4DC);
    border-radius: var(--radius-lg, 16px);
    padding: 40px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .logo-area {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }

  .gem {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }

  .brand-name {
    font-family: var(--font-display, 'Cormorant Garamond', serif);
    font-size: 24px;
    font-weight: 600;
    color: var(--fo-plum, #4A1C6F);
    letter-spacing: -0.02em;
  }

  .tagline {
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 14px;
    color: var(--muted, #8A7E70);
    font-style: italic;
    text-align: center;
    margin: 4px 0 20px;
  }

  .google-btn {
    width: 100%;
    background: var(--fo-plum, #4A1C6F);
    color: #ffffff;
    border: none;
    border-radius: var(--radius-md, 10px);
    padding: 12px 20px;
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
    letter-spacing: 0.01em;
  }

  .google-btn:hover:not(:disabled) {
    background: var(--fo-plum-m, #5D2485);
  }

  .google-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .error-msg {
    font-family: var(--font-body, 'DM Sans', sans-serif);
    font-size: 13px;
    color: var(--error, #DC2626);
    text-align: center;
    margin-top: 8px;
  }
</style>
