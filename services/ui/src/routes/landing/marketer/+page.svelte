<svelte:head>
  <title>Claw Army for E-commerce Teams — Guerrilla Growth Engine</title>
</svelte:head>

<div class="marketer-page">
  <section class="hero">
    <p class="eyebrow">UI-Marketer Landing</p>
    <h1>Launch 50 growth experiments<br />before competitors launch 5.</h1>
    <p class="subhead">
      Claw Army helps e-commerce teams run rapid, controlled growth experiments for lead capture,
      creative testing, and outreach without growing headcount.
    </p>
    <div class="actions">
      <a href="/login" class="btn-primary">Book a Growth Strategy Call</a>
      <a href="/new-execution" class="btn-secondary">Get 10 Guerrilla Campaign Ideas</a>
    </div>
  </section>

  <section class="use-cases">
    <article>
      <h2>Use-case grid</h2>
      <ul>
        <li>Lead generation angles by audience segment</li>
        <li>UGC concept generation for paid social</li>
        <li>Offer and landing copy variation testing</li>
        <li>Outreach messaging and follow-up sequencing</li>
      </ul>
    </article>

    <article>
      <h2>How it works</h2>
      <ol>
        <li>Choose campaigns + objective</li>
        <li>Set budget and campaign guardrails</li>
        <li>Deploy agents and monitor outcomes</li>
      </ol>
    </article>

    <article>
      <h2>ROI and trust</h2>
      <ul>
        <li>Budget ceilings prevent runaway spend</li>
        <li>Tool access controls reduce operational risk</li>
        <li>Performance scoring improves experiment quality</li>
      </ul>
    </article>
  </section>

  <section class="case-strip">
    <h2>Case-style scenarios</h2>
    <div class="cards">
      <div class="card">
        <h3>DTC Apparel</h3>
        <p>Run 30 ad-creative hypotheses and prioritize top 5 tests in one sprint.</p>
      </div>
      <div class="card">
        <h3>Supplements Brand</h3>
        <p>Generate segmented lead-capture offers with controlled budget guardrails.</p>
      </div>
      <div class="card">
        <h3>Beauty E-com</h3>
        <p>Launch weekly experimentation loops with measurable CAC impact.</p>
      </div>
    </div>
  </section>
</div>

<style>
  .marketer-page {
    width: min(1100px, 100%);
    margin: 0 auto;
    display: grid;
    gap: var(--s-8);
    color: #21190f;
  }

  .hero {
    background: linear-gradient(140deg, #fff6ea 0%, #ffefd8 55%, #ebffd8 100%);
    border: 1px solid #ffd39a;
    border-radius: var(--r-lg);
    padding: var(--s-8);
  }

  .eyebrow {
    color: #c85c00;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: var(--s-3);
  }

  h1 { margin: 0; font-size: clamp(1.9rem, 4vw, 3rem); line-height: 1.1; }
  .subhead { max-width: 62ch; color: #4e3b24; }

  .actions { display: flex; flex-wrap: wrap; gap: var(--s-3); margin-top: var(--s-5); }

  .btn-primary, .btn-secondary {
    padding: 0.625rem 1rem;
    border-radius: var(--r-sm);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .btn-primary { background: #ff7a00; color: #fff; }
  .btn-secondary { background: #e8ffd6; color: #2f5a00; border: 1px solid #bae989; }

  .use-cases {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: var(--s-4);
  }

  article, .case-strip {
    background: #fff8f0;
    border: 1px solid #f2dbc1;
    border-radius: var(--r-md);
    padding: var(--s-5);
  }

  article h2, .case-strip h2 { margin-top: 0; font-size: 1.1rem; }
  li { color: #5a4630; margin-bottom: 0.35rem; }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--s-3);
  }

  .card {
    background: #fff;
    border: 1px solid #efd4b7;
    border-radius: var(--r-sm);
    padding: var(--s-4);
  }

  .card h3 { margin: 0 0 var(--s-2); font-size: 1rem; }
  .card p { margin: 0; color: #5b4732; }
</style>
