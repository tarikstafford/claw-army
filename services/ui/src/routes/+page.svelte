<svelte:head>
  <title>Claw Army — AI Bot Workforce Orchestration</title>
</svelte:head>

<div class="home">

  <!-- ── HERO ── -->
  <section class="hero">
    <div class="hero-inner">

      <div class="status-badge">
        <span class="pulse-dot"></span>
        Platform operational
      </div>

      <h1>Deploy an AI workforce.<br>Watch them execute.</h1>

      <p class="lead">
        Claw Army spawns a crew of AI bots against any objective.<br>
        Parallel execution, real-time monitoring, full cost control.
      </p>

      <div class="hero-actions">
        <a href="/new-execution" class="btn-primary">Deploy a Crew</a>
        <a href="/billing" class="btn-ghost">View billing →</a>
      </div>

      <div class="hero-specs">
        <div class="spec-item">
          <span class="spec-val">20</span>
          <span class="spec-lbl">max bots</span>
        </div>
        <div class="spec-div"></div>
        <div class="spec-item">
          <span class="spec-val">SSE</span>
          <span class="spec-lbl">real-time stream</span>
        </div>
        <div class="spec-div"></div>
        <div class="spec-item">
          <span class="spec-val">$0.00</span>
          <span class="spec-lbl">surprise overruns</span>
        </div>
      </div>

    </div>
  </section>

  <!-- ── CAPABILITIES ── -->
  <section class="capabilities">
    <div class="section-inner">

      <div class="section-header">
        <span class="eyebrow">Capabilities</span>
        <h2>Everything you need to run an AI workforce</h2>
      </div>

      <div class="cap-grid">

        <div class="cap-card">
          <div class="cap-top">
            <span class="cap-tag">EX</span>
            <h3>Parallel Execution</h3>
          </div>
          <p>Deploy up to 20 bots simultaneously. They claim tasks from a shared queue, work in parallel, and report back as they complete — no coordination overhead on your end.</p>
          <div class="cap-footer">
            <span class="cap-metric">20</span>
            <span class="cap-metric-label">concurrent bots</span>
          </div>
        </div>

        <div class="cap-card">
          <div class="cap-top">
            <span class="cap-tag">MC</span>
            <h3>Live Mission Control</h3>
          </div>
          <p>Every bot action streams back in real time. Activity feed, live cost burn, budget remaining, guardrail events — you're in the cockpit the whole time, not waiting for a report.</p>
          <div class="cap-footer">
            <span class="cap-metric">Live</span>
            <span class="cap-metric-label">event stream</span>
          </div>
        </div>

        <div class="cap-card">
          <div class="cap-top">
            <span class="cap-tag">CC</span>
            <h3>Cost Control</h3>
          </div>
          <p>Set a hard budget cap per mission. We stop when it's hit. Per-bot costs, token usage, and bot-hours tracked to the cent — no surprise bills, ever.</p>
          <div class="cap-footer">
            <span class="cap-metric">Hard</span>
            <span class="cap-metric-label">budget ceiling</span>
          </div>
        </div>

        <div class="cap-card">
          <div class="cap-top">
            <span class="cap-tag">PI</span>
            <h3>Performance Intelligence</h3>
          </div>
          <p>Every bot earns a composite score after each run: task output, efficiency, reliability, tool usage, error rate. The leaderboard shows who to deploy again — and who to drop.</p>
          <div class="cap-footer">
            <span class="cap-metric">5</span>
            <span class="cap-metric-label">scoring dimensions</span>
          </div>
        </div>

        <div class="cap-card">
          <div class="cap-top">
            <span class="cap-tag">EP</span>
            <h3>Egress Perimeter</h3>
          </div>
          <p>Each bot gets a dedicated machine — full bash access, a real browser, complete filesystem. All outbound traffic routes through a metered proxy. You define which domains they can reach. Nothing else gets out.</p>
          <div class="cap-footer">
            <span class="cap-metric">Proxy</span>
            <span class="cap-metric-label">gated egress</span>
          </div>
        </div>

        <div class="cap-card cap-card--cta">
          <h3>Ready to run a mission?</h3>
          <p>Configure your objective, set crew size and budget, and deploy. First bot online in minutes.</p>
          <a href="/new-execution" class="btn-primary">Start Mission →</a>
        </div>

      </div>
    </div>
  </section>

  <!-- ── MISSION FLOW ── -->
  <section class="flow">
    <div class="section-inner">

      <span class="eyebrow">Mission Flow</span>

      <div class="steps">
        <div class="step">
          <span class="step-num">01</span>
          <h3>Write your objective</h3>
          <p>Describe the outcome you need. The bots break it into tasks and start working.</p>
        </div>
        <div class="step-arrow">→</div>
        <div class="step">
          <span class="step-num">02</span>
          <h3>Configure the crew</h3>
          <p>Set bot count, budget cap, and which tools they're allowed to use.</p>
        </div>
        <div class="step-arrow">→</div>
        <div class="step">
          <span class="step-num">03</span>
          <h3>Deploy and monitor</h3>
          <p>Launch. Watch the live activity feed. Review the post-run performance report.</p>
        </div>
      </div>

    </div>
  </section>

  <!-- ── FOOTER CTA ── -->
  <section class="footer-cta">
    <div class="section-inner">
      <h2>Your AI workforce is standing by.</h2>
      <p>Define the mission. They'll handle the rest.</p>
      <a href="/new-execution" class="btn-primary">Deploy a Crew</a>
    </div>
  </section>

</div>

<style>
  /* Break out of main's padding so sections are full-width */
  .home {
    width: calc(100% + var(--s-6) * 2);
    margin-top: calc(-1 * var(--s-8));
    margin-left: calc(-1 * var(--s-6));
    margin-right: calc(-1 * var(--s-6));
  }

  /* ── Shared ── */
  .section-inner {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 var(--s-6);
  }

  .eyebrow {
    display: block;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--signal);
    margin-bottom: var(--s-4);
  }

  /* ── Hero ── */
  .hero {
    padding: var(--s-24) var(--s-6) var(--s-20);
    border-bottom: 1px solid var(--border);
    text-align: center;
  }

  .hero-inner {
    max-width: 680px;
    margin: 0 auto;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    padding: 0.3125rem 0.75rem;
    background: var(--active-tint);
    border: 1px solid var(--active-border);
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--active);
    letter-spacing: 0.02em;
    margin-bottom: var(--s-6);
  }

  .pulse-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--active);
    flex-shrink: 0;
    animation: pulse 2.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.75); }
  }

  h1 {
    font-size: clamp(2rem, 5vw, 3.25rem);
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.025em;
    color: var(--text-primary);
    margin-bottom: var(--s-5);
  }

  .lead {
    font-size: 1.0625rem;
    color: var(--text-secondary);
    line-height: 1.65;
    margin-bottom: var(--s-8);
  }

  .hero-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--s-4);
    margin-bottom: var(--s-12);
    flex-wrap: wrap;
  }

  .hero-specs {
    display: inline-flex;
    align-items: center;
    gap: var(--s-5);
    padding: var(--s-3) var(--s-5);
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }

  .spec-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .spec-val {
    font-family: ui-monospace, 'SF Mono', 'Cascadia Mono', monospace;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .spec-lbl {
    font-size: 0.6875rem;
    color: var(--text-muted);
    letter-spacing: 0.03em;
  }

  .spec-div {
    width: 1px;
    height: 28px;
    background: var(--border);
  }

  /* ── Buttons ── */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 0.625rem 1.25rem;
    background: var(--signal);
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: var(--r-sm);
    letter-spacing: 0.01em;
    transition: background 0.15s;
  }

  .btn-primary:hover {
    background: #5a8fff;
    color: #fff;
  }

  .btn-ghost {
    display: inline-flex;
    align-items: center;
    font-size: 0.875rem;
    color: var(--text-secondary);
    transition: color 0.15s;
  }

  .btn-ghost:hover {
    color: var(--text-primary);
  }

  /* ── Capabilities ── */
  .capabilities {
    padding: var(--s-20) 0;
    border-bottom: 1px solid var(--border);
  }

  .section-header {
    margin-bottom: var(--s-10);
  }

  .section-header h2 {
    font-size: clamp(1.25rem, 3vw, 1.75rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .cap-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-4);
  }

  .cap-card {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding: var(--s-6);
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    transition: border-color 0.2s, background 0.2s;
    position: relative;
    overflow: hidden;
  }

  .cap-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--signal);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .cap-card:hover {
    border-color: var(--signal-border);
    background: var(--surface-2);
  }

  .cap-card:hover::before {
    opacity: 1;
  }

  .cap-top {
    display: flex;
    align-items: center;
    gap: var(--s-3);
  }

  .cap-tag {
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--signal);
    background: var(--signal-tint);
    border: 1px solid var(--signal-border);
    padding: 0.125rem 0.375rem;
    border-radius: var(--r-sm);
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  .cap-card h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .cap-card p {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.65;
    flex: 1;
  }

  .cap-footer {
    display: flex;
    align-items: baseline;
    gap: var(--s-2);
    padding-top: var(--s-3);
    border-top: 1px solid var(--border-soft);
    margin-top: auto;
  }

  .cap-metric {
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .cap-metric-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    letter-spacing: 0.02em;
  }

  .cap-card--cta {
    background: var(--signal-tint);
    border-color: var(--signal-border);
    justify-content: center;
    align-items: flex-start;
  }

  .cap-card--cta::before {
    opacity: 1;
  }

  .cap-card--cta h3 {
    font-size: 1rem;
  }

  .cap-card--cta p {
    margin-bottom: var(--s-2);
  }

  /* ── Mission Flow ── */
  .flow {
    padding: var(--s-20) 0;
    border-bottom: 1px solid var(--border);
  }

  .steps {
    display: flex;
    align-items: flex-start;
    gap: var(--s-4);
    margin-top: var(--s-2);
  }

  .step {
    flex: 1;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding: var(--s-6);
  }

  .step-num {
    display: block;
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--signal);
    letter-spacing: 0.06em;
    margin-bottom: var(--s-3);
  }

  .step h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: var(--s-2);
  }

  .step p {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.65;
  }

  .step-arrow {
    font-size: 1.25rem;
    color: var(--text-faint);
    padding-top: var(--s-8);
    flex-shrink: 0;
  }

  /* ── Footer CTA ── */
  .footer-cta {
    padding: var(--s-20) 0 var(--s-24);
    text-align: center;
  }

  .footer-cta h2 {
    font-size: clamp(1.375rem, 3vw, 2rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin-bottom: var(--s-3);
  }

  .footer-cta p {
    font-size: 0.9375rem;
    color: var(--text-secondary);
    margin-bottom: var(--s-8);
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .cap-grid {
      grid-template-columns: 1fr;
    }

    .steps {
      flex-direction: column;
    }

    .step-arrow {
      padding-top: 0;
      transform: rotate(90deg);
      align-self: center;
    }
  }
</style>
