<script lang="ts">
  import '../app.css';
  import { signOut } from '@auth/sveltekit/client';

  let { children, data } = $props();
  let session = $derived(data.session);
</script>

<nav>
  <div class="nav-inner">
    <a href="/" class="brand">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 1.5L17.5 5.75V14.25L10 18.5L2.5 14.25V5.75L10 1.5Z"
          stroke="#3d7eff" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
        <circle cx="10" cy="10" r="3" fill="#3d7eff"/>
      </svg>
      <span>Claw Army</span>
    </a>
    <div class="nav-right">
      <a href="/billing" class="nav-link">Billing</a>
      {#if session?.user}
        <div class="user-info">
          {#if session.user.image}
            <img
              src={session.user.image}
              alt={session.user.name ?? 'User avatar'}
              class="user-avatar"
              width="28"
              height="28"
            />
          {/if}
          <span class="user-name">{session.user.name}</span>
          <button class="sign-out-btn" onclick={() => signOut({ redirectTo: '/' })}>
            Sign out
          </button>
        </div>
      {:else}
        <a href="/new-execution" class="nav-cta">Deploy Crew</a>
      {/if}
    </div>
  </div>
</nav>

<main>
  {@render children()}
</main>

<style>
  nav {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(9, 13, 24, 0.92);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
  }

  .nav-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 var(--s-6);
    height: 52px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    color: var(--text-primary);
    font-weight: 700;
    font-size: 0.875rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .brand:hover {
    color: var(--text-primary);
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: var(--s-4);
  }

  .nav-link {
    font-size: 0.875rem;
    color: var(--text-secondary);
    transition: color 0.15s;
  }

  .nav-link:hover {
    color: var(--text-primary);
  }

  .nav-cta {
    padding: 0.375rem 0.875rem;
    background: var(--signal);
    color: #fff;
    font-size: 0.8125rem;
    font-weight: 600;
    border-radius: var(--r-sm);
    letter-spacing: 0.01em;
    transition: background 0.15s;
  }

  .nav-cta:hover {
    background: #5a8fff;
    color: #fff;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: var(--s-3);
  }

  .user-avatar {
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--border);
  }

  .user-name {
    font-size: 0.875rem;
    color: var(--text-secondary);
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sign-out-btn {
    font-size: 0.8125rem;
    color: var(--text-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
  }

  .sign-out-btn:hover {
    color: var(--text-secondary);
  }

  main {
    width: 100%;
    padding: var(--s-8) var(--s-6);
  }
</style>
