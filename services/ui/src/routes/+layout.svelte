<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<nav>
  <div class="nav-inner">
    <span class="brand">Claw Army</span>
    <a href="/new-execution">New Execution</a>
    <a href="/billing">Billing</a>
  </div>
</nav>

<main>
  {@render children()}
</main>

<style>
  nav {
    background: #1a1a1a;
    color: #fff;
    padding: 0 1.5rem;
  }

  .nav-inner {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    height: 3rem;
    max-width: 900px;
    margin: 0 auto;
  }

  .brand {
    font-weight: 700;
    font-size: 1.1rem;
    margin-right: auto;
  }

  nav a {
    color: #ccc;
    font-size: 0.9rem;
  }

  nav a:hover {
    color: #fff;
    text-decoration: none;
  }

  main {
    max-width: 900px;
    margin: 2rem auto;
    padding: 0 1.5rem;
  }
</style>
