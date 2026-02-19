<svelte:head>
  <title>Claw Army for Agents — Delegate Like a Boss</title>
</svelte:head>

<div class="agent-page">
  <section class="hero">
    <p class="eyebrow">UI-Agent Landing</p>
    <h1>Stop doing everything yourself.<br />Spawn the army.</h1>
    <p class="subhead">
      Claw Army gives agentic operators a parallel AI workforce with hard guardrails,
      controlled tooling, and clear performance scoring.
    </p>
    <div class="actions">
      <a href="/login" class="btn-primary">Join the Bot Boss Waitlist</a>
      <a href="/new-execution" class="btn-secondary">Watch a 90-sec swarm demo</a>
    </div>
  </section>

  <section class="panel-grid">
    <article class="panel">
      <h2>Your bot problems</h2>
      <ul>
        <li>Too many tasks and no delegation layer</li>
        <li>Context switching across prompts and tools</li>
        <li>No hard stop for spend or runtime</li>
      </ul>
    </article>

    <article class="panel">
      <h2>How Claw Army works</h2>
      <ol>
        <li>Set objective + bot count</li>
        <li>Configure budget and tool permissions</li>
        <li>Deploy in parallel and monitor in real time</li>
      </ol>
    </article>

    <article class="panel">
      <h2>Guardrails and proof</h2>
      <ul>
        <li>Budget/runtimes enforce automatic stops</li>
        <li>Tool Gateway + runtime isolation model</li>
        <li>Execution activity visible in Mission Control</li>
      </ul>
    </article>

    <article class="panel">
      <h2>Leaderboard + DNA flywheel</h2>
      <ul>
        <li>Bot scoring: output, reliability, efficiency</li>
        <li>Performance leaderboard for deployment choices</li>
        <li>DNA capture that improves future missions</li>
      </ul>
    </article>
  </section>

  <section class="faq">
    <h2>FAQ</h2>
    <details>
      <summary>Can bots run without limits?</summary>
      <p>No. Budget and runtime guardrails cap execution automatically.</p>
    </details>
    <details>
      <summary>How is tool access controlled?</summary>
      <p>Each mission defines allowed tools and bots run in isolated environments.</p>
    </details>
    <details>
      <summary>Is this meant to replace human operators?</summary>
      <p>No. It is a delegation layer so operators can orchestrate more work safely.</p>
    </details>
  </section>
</div>

<style>
  .agent-page {
    width: min(1100px, 100%);
    margin: 0 auto;
    display: grid;
    gap: var(--s-8);
  }

  .hero {
    background: radial-gradient(circle at top, #1c2e4f 0%, #0b101d 60%);
    border: 1px solid #2f446f;
    border-radius: var(--r-lg);
    padding: var(--s-8);
  }

  .eyebrow {
    color: #8ec5ff;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: var(--s-3);
  }

  h1 { margin: 0; font-size: clamp(1.9rem, 4vw, 3rem); }
  .subhead { color: var(--text-secondary); max-width: 60ch; }

  .actions { display: flex; flex-wrap: wrap; gap: var(--s-3); margin-top: var(--s-5); }

  .btn-primary, .btn-secondary {
    padding: 0.625rem 1rem;
    border-radius: var(--r-sm);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .btn-primary { background: #4f8cff; color: white; }
  .btn-secondary { background: #182033; color: #b5c6e6; border: 1px solid #2a395e; }

  .panel-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--s-4);
  }

  .panel {
    background: #0f1526;
    border: 1px solid #273455;
    border-radius: var(--r-md);
    padding: var(--s-5);
  }

  .panel h2, .faq h2 { margin-top: 0; font-size: 1.1rem; }
  li { color: var(--text-secondary); margin-bottom: 0.4rem; }

  .faq {
    background: #0f1526;
    border: 1px solid #273455;
    border-radius: var(--r-md);
    padding: var(--s-5);
  }

  details { border-top: 1px solid #26314e; padding: var(--s-3) 0; }
  details:first-of-type { border-top: none; }
  summary { cursor: pointer; font-weight: 600; }
  details p { color: var(--text-secondary); margin-bottom: 0; }
</style>
