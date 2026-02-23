<svelte:head>
  <title>Guide | Akasa</title>
</svelte:head>

<div class="guide">

  <!-- ── PAGE HEADER ── -->
  <div class="guide-header">
    <span class="eyebrow">Documentation</span>
    <h1>How Akasa works</h1>
    <p class="subtitle">Everything you need to deploy, monitor, and evolve your AI workforce.</p>
  </div>

  <!-- ── TABLE OF CONTENTS ── -->
  <nav class="toc" aria-label="Table of contents">
    <a href="#quick-start">Quick Start</a>
    <span class="toc-div"></span>
    <a href="#objective">Writing Objectives</a>
    <span class="toc-div"></span>
    <a href="#army-builder">Army Builder</a>
    <span class="toc-div"></span>
    <a href="#crew-config">Crew Config</a>
    <span class="toc-div"></span>
    <a href="#mission-control">Mission Control</a>
    <span class="toc-div"></span>
    <a href="#dna-evolution">DNA &amp; Evolution</a>
    <span class="toc-div"></span>
    <a href="#verdicts">Verdicts</a>
    <span class="toc-div"></span>
    <a href="#billing">Billing</a>
    <span class="toc-div"></span>
    <a href="#guardrails">Guardrails</a>
  </nav>

  <!-- ── 1. QUICK START ── -->
  <section id="quick-start" class="section">
    <div class="section-label">
      <span class="tag">01</span>
      Quick Start
    </div>
    <h2>Run your first mission in three steps</h2>
    <p class="section-lead">Akasa turns a plain-language objective into a fleet of AI bots working in parallel. Here's the loop:</p>

    <div class="steps-row">
      <div class="step-card">
        <span class="step-num">01</span>
        <h3>Write your objective</h3>
        <p>Go to <a href="/new-execution">New Mission</a> and describe the outcome you want. Be specific about the result — not the process. Run Army Builder Analysis to see what agents are available for the job.</p>
      </div>
      <div class="step-arrow">→</div>
      <div class="step-card">
        <span class="step-num">02</span>
        <h3>Configure the crew</h3>
        <p>Set crew size (1–20 bots), a hard budget cap, your LLM provider, and the egress perimeter — which external domains your bots are allowed to reach.</p>
      </div>
      <div class="step-arrow">→</div>
      <div class="step-card">
        <span class="step-num">03</span>
        <h3>Deploy and review</h3>
        <p>Launch. Watch the live activity feed as bots work in parallel. Once the mission completes, review the performance report and handle Promote/Retire verdicts.</p>
      </div>
    </div>

    <div class="callout callout--violet">
      <span class="callout-label">TIP</span>
      <p>Start with a small crew (3–5 bots) and a conservative budget ($5–$10) on your first run. Once you understand the cost profile of your objective type, scale up.</p>
    </div>
  </section>

  <!-- ── 2. WRITING OBJECTIVES ── -->
  <section id="objective" class="section">
    <div class="section-label">
      <span class="tag">02</span>
      Writing Objectives
    </div>
    <h2>How to write an effective objective</h2>
    <p class="section-lead">The objective is the single most important input. Bots decompose it into independent, parallelizable tasks — so clarity and specificity directly determine mission quality.</p>

    <div class="two-col">
      <div class="col-card col-card--good">
        <div class="col-card-label">
          <span class="badge badge--good">Good</span>
        </div>
        <ul class="check-list">
          <li>Describe the <strong>outcome</strong>, not the steps ("Extract all product names and prices from these 50 URLs and write them to a CSV")</li>
          <li>Specify the <strong>format</strong> you want output in</li>
          <li>Include relevant <strong>constraints</strong> (e.g. "only include items priced under $100")</li>
          <li>Mention the <strong>scope</strong> (how many items, how many pages, how many sources)</li>
          <li>State what <strong>success</strong> looks like ("Each row should have: name, price, URL, date")</li>
        </ul>
      </div>
      <div class="col-card col-card--bad">
        <div class="col-card-label">
          <span class="badge badge--avoid">Avoid</span>
        </div>
        <ul class="check-list">
          <li>Vague goals ("Research my competitors")</li>
          <li>Tasks with implicit dependencies or sequential steps that can't be parallelized</li>
          <li>Tasks requiring persistent state across bots</li>
          <li>Objectives that require real-time interaction or human input mid-run</li>
          <li>Tasks that require accessing domains not on your egress allowlist</li>
        </ul>
      </div>
    </div>

    <h3 class="subsection-head">Example objectives</h3>
    <div class="example-list">
      <div class="example">
        <span class="example-tag">Research</span>
        <p>"For each of the following 30 SaaS companies, find: their pricing page URL, number of pricing tiers, lowest paid plan price, and whether they offer a free tier. Output as JSON."</p>
      </div>
      <div class="example">
        <span class="example-tag">Content</span>
        <p>"Write a 300-word product description for each of the 20 items in the attached list. Tone: professional but approachable. Include one key benefit and one call to action per description."</p>
      </div>
      <div class="example">
        <span class="example-tag">Data processing</span>
        <p>"Read each of the 50 support tickets in the queue. Classify each as: bug report, feature request, billing issue, or other. Extract the customer's stated problem in one sentence. Output as a table."</p>
      </div>
    </div>
  </section>

  <!-- ── 3. ARMY BUILDER ── -->
  <section id="army-builder" class="section">
    <div class="section-label">
      <span class="tag">03</span>
      Army Builder Analysis
    </div>
    <h2>Pre-deployment intelligence</h2>
    <p class="section-lead">Before launching a mission, run Army Builder Analysis. It reads your objective and gives you a readiness report on the agent pool available for the job.</p>

    <div class="feature-grid">
      <div class="feature-card">
        <div class="feature-tag">Categories</div>
        <h3>Task Category Detection</h3>
        <p>The system classifies your objective into task categories (e.g. web research, data extraction, content generation). This determines which agent specializations are relevant.</p>
      </div>
      <div class="feature-card">
        <div class="feature-tag">Library Depth</div>
        <h3>Agent Library Depth</h3>
        <p>For each detected category, the system shows how many Novice, Understudy, and Artisan agents are available in your library. More Artisans means higher-quality results from the start.</p>
      </div>
      <div class="feature-card">
        <div class="feature-tag">Tiers</div>
        <h3>Composition Tiers</h3>
        <p>Three deployment options are shown: <strong>Full</strong> (all available agents), <strong>75%</strong> (reduced crew), and <strong>Minimum Viable</strong> (smallest functional crew). Pick based on your budget and urgency.</p>
      </div>
    </div>

    <div class="callout callout--amber">
      <span class="callout-label callout-label--amber">NOTE</span>
      <p>If Army Builder shows zero agents in your library for a detected category, new Novice agents will be spawned for this mission. They'll earn DNA as they work — subsequent missions in the same category will benefit from their experience.</p>
    </div>

    <h3 class="subsection-head">When the analysis blocks a launch</h3>
    <p>In some cases Army Builder will block the <strong>Launch Mission</strong> button. This happens when your current crew size setting is below the minimum viable threshold for the detected task complexity. Reduce scope, increase crew size, or simplify the objective to unblock.</p>
  </section>

  <!-- ── 4. CREW CONFIG ── -->
  <section id="crew-config" class="section">
    <div class="section-label">
      <span class="tag">04</span>
      Crew Configuration
    </div>
    <h2>Configuring your crew</h2>
    <p class="section-lead">Four parameters control how your mission runs. Each directly affects cost, quality, and what the bots can do.</p>

    <div class="config-list">

      <div class="config-item">
        <div class="config-meta">
          <span class="config-num">02</span>
          <h3>Crew Size</h3>
          <span class="config-range">1 – 20 bots</span>
        </div>
        <div class="config-body">
          <p>The number of bots deployed simultaneously. More bots means faster parallel execution but higher cost. Each bot claims tasks from the shared queue independently — there's no bot-to-bot coordination.</p>
          <div class="config-tip">
            <strong>Rule of thumb:</strong> Match crew size roughly to the number of independent tasks. 50 tasks with 5 bots = ~10 tasks per bot. 50 tasks with 20 bots = ~2–3 tasks per bot, much faster.
          </div>
        </div>
      </div>

      <div class="config-item">
        <div class="config-meta">
          <span class="config-num">03</span>
          <h3>Budget Cap</h3>
          <span class="config-range">Hard ceiling in USD</span>
        </div>
        <div class="config-body">
          <p>The maximum your mission can spend, to the cent. When this is hit, execution stops immediately — no overruns, no surprises. Set it conservatively on your first run for a given objective type.</p>
          <div class="config-tip">
            <strong>What counts toward the budget:</strong> LLM token costs (inference), bot-hours on compute, and tool call metering through the gateway.
          </div>
        </div>
      </div>

      <div class="config-item">
        <div class="config-meta">
          <span class="config-num">04</span>
          <h3>LLM Provider</h3>
          <span class="config-range">Anthropic · OpenAI</span>
        </div>
        <div class="config-body">
          <p>Choose which model powers the crew. All bots in a mission use the same provider.</p>
          <div class="provider-table">
            <div class="provider-row">
              <span class="provider-name">Anthropic</span>
              <span class="provider-desc">Claude models. Strong at reasoning, long-context tasks, and structured output. Generally better for complex multi-step objectives.</span>
            </div>
            <div class="provider-row">
              <span class="provider-name">OpenAI</span>
              <span class="provider-desc">GPT models. Good general-purpose performance. Use if you have a preference or if your objective type performs better with GPT.</span>
            </div>
          </div>
        </div>
      </div>

      <div class="config-item">
        <div class="config-meta">
          <span class="config-num">05</span>
          <h3>Egress Perimeter</h3>
          <span class="config-range">Domain allowlist</span>
        </div>
        <div class="config-body">
          <p>A comma-separated list of domains that bots are permitted to reach through the Tool Gateway proxy. All other outbound traffic is blocked — bots can't access anything not on this list.</p>
          <div class="code-block">
            <span class="code-comment"># Default allowlist</span>
            api.anthropic.com, api.openai.com, github.com,
            objects.githubusercontent.com, registry.npmjs.org
          </div>
          <div class="config-tip">
            <strong>Add domains your objective needs.</strong> For web research tasks, add the specific site domains you want scraped. Only add what's necessary — every additional domain expands the attack surface.
          </div>
        </div>
      </div>

    </div>
  </section>

  <!-- ── 5. MISSION CONTROL ── -->
  <section id="mission-control" class="section">
    <div class="section-label">
      <span class="tag">05</span>
      Live Mission Control
    </div>
    <h2>Reading the execution view</h2>
    <p class="section-lead">Once a mission launches, the execution view gives you a real-time window into everything happening across the crew.</p>

    <div class="feature-grid">
      <div class="feature-card">
        <div class="feature-tag">Status Bar</div>
        <h3>Mission Status</h3>
        <p>Shows current state: <code>running</code>, <code>paused</code>, <code>completed</code>, <code>stopped</code>, or <code>failed</code>. Alongside: active bot count, tasks completed vs total, and time elapsed.</p>
      </div>
      <div class="feature-card">
        <div class="feature-tag">Cost Meter</div>
        <h3>Live Cost Burn</h3>
        <p>Real-time spend counter and budget remaining. Watch the burn rate and intervene if it's higher than expected — you can stop a mission at any time from the execution view.</p>
      </div>
      <div class="feature-card">
        <div class="feature-tag">Activity Feed</div>
        <h3>Event Stream</h3>
        <p>Every bot action appears here as it happens. Key event types to know:</p>
        <ul class="event-list">
          <li><code>task_claimed</code> — a bot picked up a task</li>
          <li><code>tool_invoked</code> — a bot called an external tool</li>
          <li><code>task_completed</code> — a bot finished a task</li>
          <li><code>guardrail_triggered</code> — a safety limit fired</li>
          <li><code>bot_stopped</code> — a bot was terminated</li>
        </ul>
      </div>
    </div>

    <h3 class="subsection-head">After the mission: the performance report</h3>
    <p>When execution ends, a full report is generated. It includes total cost, bot-hours consumed, tasks completed, average bot score, and a leaderboard ranking every bot that ran. Use this to understand which agents performed and which didn't — then handle their verdicts.</p>
  </section>

  <!-- ── 6. DNA & EVOLUTION ── -->
  <section id="dna-evolution" class="section">
    <div class="section-label">
      <span class="tag">06</span>
      Bot DNA &amp; Evolution
    </div>
    <h2>How your army gets better over time</h2>
    <p class="section-lead">Every bot that runs earns structured performance DNA. Over time, your agent library builds up a pool of experienced, specialized bots — making future missions faster, cheaper, and higher quality.</p>

    <div class="tier-row">
      <div class="tier-card tier-novice">
        <span class="tier-label">NOVICE</span>
        <p>Newly spawned agents with no prior mission history. Start here on their first deployment. High variance — some will excel, others won't. All earn DNA that shapes their tier assignment.</p>
      </div>
      <div class="tier-arrow">→</div>
      <div class="tier-card tier-understudy">
        <span class="tier-label">UNDERSTUDY</span>
        <p>Agents that demonstrated above-average performance and were promoted after a verdict review. More reliable than Novices. Preferred by Army Builder when available for a detected task category.</p>
      </div>
      <div class="tier-arrow">→</div>
      <div class="tier-card tier-artisan">
        <span class="tier-label">ARTISAN</span>
        <p>Elite agents with proven track records across multiple missions. Highest quality, lowest error rate. Army Builder prioritizes Artisans when composing a crew. Built through consistent strong performance and confirmed Promote verdicts.</p>
      </div>
    </div>

    <h3 class="subsection-head">What goes into bot DNA</h3>
    <div class="dna-grid">
      <div class="dna-item">
        <span class="dna-label">System prompt</span>
        <span class="dna-desc">The base instructions the bot operated under</span>
      </div>
      <div class="dna-item">
        <span class="dna-label">Planning approach</span>
        <span class="dna-desc">How the bot decomposed and sequenced work</span>
      </div>
      <div class="dna-item">
        <span class="dna-label">Tool call sequence</span>
        <span class="dna-desc">Which tools were called, in what order</span>
      </div>
      <div class="dna-item">
        <span class="dna-label">Retry strategy</span>
        <span class="dna-desc">How errors and failures were handled</span>
      </div>
      <div class="dna-item">
        <span class="dna-label">Token distribution</span>
        <span class="dna-desc">Efficiency profile across the task</span>
      </div>
      <div class="dna-item">
        <span class="dna-label">Decision branches</span>
        <span class="dna-desc">The conditional logic patterns used</span>
      </div>
    </div>

    <div class="callout callout--amber">
      <span class="callout-label callout-label--amber">HOW IT COMPOUNDS</span>
      <p>The more you run missions in the same category (e.g. web research, data extraction), the deeper your specialized agent library becomes. After 5–10 missions, Army Builder will consistently surface Artisan-tier agents for those categories, significantly improving output quality.</p>
    </div>
  </section>

  <!-- ── 7. VERDICTS ── -->
  <section id="verdicts" class="section">
    <div class="section-label">
      <span class="tag">07</span>
      Verdicts &amp; Governance
    </div>
    <h2>Human-in-the-loop workforce decisions</h2>
    <p class="section-lead">After every mission, the system generates Promote and Retire recommendations for bots that hit performance thresholds. You review and confirm — keeping the AI workforce quality-controlled, not just automated.</p>

    <div class="two-col">
      <div class="verdict-card verdict-promote">
        <span class="verdict-badge verdict-badge--promote">PROMOTE</span>
        <h3>Promote verdicts</h3>
        <p>Generated when a bot's composite score exceeds the execution average by a meaningful margin, with a low error rate and high efficiency. Confirming a Promote verdict advances the bot's tier (Novice → Understudy, Understudy → Artisan).</p>
      </div>
      <div class="verdict-card verdict-retire">
        <span class="verdict-badge verdict-badge--retire">RETIRE</span>
        <h3>Retire verdicts</h3>
        <p>Generated when a bot shows persistent underperformance — high error rates, low task completion, or triggered guardrails. Confirming a Retire verdict removes the bot from the active library so it's not re-deployed.</p>
      </div>
    </div>

    <h3 class="subsection-head">The verdict review process</h3>
    <ol class="numbered-list">
      <li>Go to <a href="/verdicts">Verdicts</a>. Pending verdicts from recent missions appear here, refreshed every 15 seconds.</li>
      <li>Click a verdict to open the detail view. Review the bot's performance evidence: score breakdown, tasks completed, error count, tool usage, cost.</li>
      <li>Each verdict includes a <strong>confidence score</strong> — how certain the system is about its recommendation. Low confidence (below ~60%) warrants more scrutiny.</li>
      <li>If you want to stress-test the recommendation, use <strong>Devil's Advocate</strong> — the system will generate counter-arguments against its own verdict. Resolve them before confirming.</li>
      <li>Confirm or dismiss the verdict. Confirmed verdicts immediately update the bot's tier and library status.</li>
    </ol>

    <h3 class="subsection-head">Calibration warnings</h3>
    <p>The system tracks your verdict confirmation rate. If you confirm a very high percentage of verdicts without engaging Devil's Advocate, a calibration warning appears. This is a nudge to review more carefully — rubber-stamping verdicts degrades the quality filter over time.</p>

    <div class="callout callout--amber">
      <span class="callout-label callout-label--amber">BEST PRACTICE</span>
      <p>Don't dismiss low-confidence verdicts without reading the evidence. A borderline Promote may still be valid for a specific task category even if the overall score is marginal. Context matters.</p>
    </div>
  </section>

  <!-- ── 8. BILLING ── -->
  <section id="billing" class="section">
    <div class="section-label">
      <span class="tag">08</span>
      Billing &amp; Usage
    </div>
    <h2>How costs are calculated</h2>
    <p class="section-lead">Akasa charges on a bot-hour basis, plus metered tool usage through the gateway. There are no seat fees or subscriptions — you pay for what you run.</p>

    <div class="billing-formula">
      <div class="formula-line">
        <span class="formula-label">Bot compute</span>
        <span class="formula-expr">Σ (bot runtime in hours) × hourly rate</span>
      </div>
      <div class="formula-plus">+</div>
      <div class="formula-line">
        <span class="formula-label">LLM inference</span>
        <span class="formula-expr">Token usage × provider rate (input + output)</span>
      </div>
      <div class="formula-plus">+</div>
      <div class="formula-line">
        <span class="formula-label">Egress metering</span>
        <span class="formula-expr">Tool gateway calls × per-call rate</span>
      </div>
      <div class="formula-eq">= Total mission cost</div>
    </div>

    <h3 class="subsection-head">What you'll see in Billing</h3>
    <div class="feature-grid">
      <div class="feature-card">
        <div class="feature-tag">Monthly Summary</div>
        <h3>This month at a glance</h3>
        <p>Total bot-hours consumed, estimated spend, and number of executions run in the current billing period.</p>
      </div>
      <div class="feature-card">
        <div class="feature-tag">Execution History</div>
        <h3>Per-execution breakdown</h3>
        <p>A table of every past execution with its cost, bot-hours, task count, and status. Useful for understanding the cost profile of different objective types.</p>
      </div>
    </div>

    <div class="callout callout--violet">
      <span class="callout-label">COST CONTROL</span>
      <p>The budget cap you set at mission creation is enforced in real time. Execution halts the moment the cap is hit — you will never be charged more than you authorized for a given mission.</p>
    </div>
  </section>

  <!-- ── 9. GUARDRAILS ── -->
  <section id="guardrails" class="section">
    <div class="section-label">
      <span class="tag">09</span>
      Guardrails
    </div>
    <h2>How bots are kept safe and in bounds</h2>
    <p class="section-lead">Akasa runs hard safety controls on every bot. These are non-negotiable — they can't be disabled by mission configuration.</p>

    <div class="guardrail-list">

      <div class="guardrail-item">
        <div class="guardrail-meta">
          <span class="guardrail-tag">BG</span>
          <h3>Budget Enforcement</h3>
        </div>
        <p>When total mission spend reaches the configured budget cap, execution stops immediately. All active bots are terminated. No overruns are possible.</p>
      </div>

      <div class="guardrail-item">
        <div class="guardrail-meta">
          <span class="guardrail-tag">TL</span>
          <h3>Token Burn Limits</h3>
        </div>
        <p>Each bot has a maximum token consumption rate (tokens per minute). A bot burning tokens faster than this threshold — indicating runaway generation — is flagged and can be terminated by the watchdog.</p>
      </div>

      <div class="guardrail-item">
        <div class="guardrail-meta">
          <span class="guardrail-tag">RL</span>
          <h3>Tool Call Rate Limits</h3>
        </div>
        <p>Bots are limited in how many tool calls they can make per minute. This prevents a single bot from flooding external APIs or running up egress costs through rapid repeated calls.</p>
      </div>

      <div class="guardrail-item">
        <div class="guardrail-meta">
          <span class="guardrail-tag">LD</span>
          <h3>Loop Detection</h3>
        </div>
        <p>The watchdog monitors for repetitive behavior — a bot making the same tool call in a loop, retrying the same failed step indefinitely, or generating identical output repeatedly. Detected thrash behavior terminates the bot and returns its task to the queue for reassignment.</p>
      </div>

      <div class="guardrail-item">
        <div class="guardrail-meta">
          <span class="guardrail-tag">IS</span>
          <h3>Idle Shutdown</h3>
        </div>
        <p>A bot that sits idle for more than 5 minutes (no task claimed, no tool calls in progress) is automatically terminated. This prevents abandoned bots from accumulating bot-hours without doing work.</p>
      </div>

      <div class="guardrail-item">
        <div class="guardrail-meta">
          <span class="guardrail-tag">EP</span>
          <h3>Egress Perimeter</h3>
        </div>
        <p>All bot outbound traffic routes through the Tool Gateway proxy. Any request to a domain not on the allowlist is blocked and logged as a guardrail event. Bots have no direct internet access — they cannot exfiltrate data or reach unauthorized services.</p>
      </div>

    </div>

    <div class="callout callout--violet">
      <span class="callout-label">WHAT HAPPENS ON GUARDRAIL TRIGGER</span>
      <p>When a guardrail fires: the offending bot is revoked, the event is logged in the activity feed as <code>guardrail_triggered</code>, and the execution may be paused or stopped depending on severity. The bot's task is returned to the queue for reassignment to a healthy bot if the mission continues.</p>
    </div>
  </section>

  <!-- ── FOOTER ── -->
  <div class="guide-footer">
    <a href="/new-execution" class="btn-primary">Deploy a Crew →</a>
    <a href="/verdicts" class="btn-ghost">Review Verdicts</a>
  </div>

</div>

<style>
  .guide {
    max-width: 820px;
    margin: 0 auto;
  }

  /* ── Page header ── */
  .guide-header {
    margin-bottom: var(--s-10);
    padding-bottom: var(--s-8);
    border-bottom: 1px solid var(--border);
  }

  .eyebrow {
    display: block;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-family: var(--font-mono);
    color: var(--text-faint);
    margin-bottom: var(--s-3);
  }

  .guide-header h1 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    font-family: var(--font-display);
    color: var(--text);
    margin-bottom: var(--s-3);
  }

  .subtitle {
    font-size: 1rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.6;
  }

  /* ── TOC ── */
  .toc {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-3) var(--s-4);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    margin-bottom: var(--s-12);
  }

  .toc a {
    font-size: 0.8125rem;
    color: var(--text-muted);
    transition: color 0.15s;
    white-space: nowrap;
  }

  .toc a:hover {
    color: var(--violet-bright);
  }

  .toc-div {
    width: 1px;
    height: 12px;
    background: var(--border);
    flex-shrink: 0;
  }

  /* ── Sections ── */
  .section {
    padding-top: var(--s-12);
    padding-bottom: var(--s-12);
    border-bottom: 1px solid var(--border);
  }

  .section:last-of-type {
    border-bottom: none;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-family: var(--font-mono);
    color: var(--text-faint);
    margin-bottom: var(--s-3);
  }

  .tag {
    font-family: var(--font-mono);
    color: var(--violet-bright);
  }

  .section h2 {
    font-size: clamp(1.25rem, 3vw, 1.625rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    font-family: var(--font-display);
    color: var(--text);
    margin-bottom: var(--s-4);
  }

  .section-lead {
    font-size: 0.9375rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.7;
    margin-bottom: var(--s-8);
  }

  .subsection-head {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
    margin: var(--s-8) 0 var(--s-4);
  }

  /* ── Quick start steps ── */
  .steps-row {
    display: flex;
    align-items: flex-start;
    gap: var(--s-3);
    margin-bottom: var(--s-6);
  }

  .step-card {
    flex: 1;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: var(--s-5);
    transition: border-color 0.15s;
  }

  .step-card:hover {
    border-color: var(--border-mid);
  }

  .step-num {
    display: block;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--violet-bright);
    letter-spacing: 0.06em;
    margin-bottom: var(--s-3);
  }

  .step-card h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: var(--s-2);
  }

  .step-card p {
    font-size: 0.875rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.65;
  }

  .step-arrow {
    font-size: 1.125rem;
    color: var(--text-faint);
    padding-top: var(--s-8);
    flex-shrink: 0;
  }

  /* ── Callout boxes ── */
  .callout {
    display: flex;
    align-items: flex-start;
    gap: var(--s-4);
    padding: var(--s-4) var(--s-5);
    border-radius: 14px;
    margin-top: var(--s-6);
  }

  .callout--violet {
    background: var(--violet-dim);
    border: 1px solid var(--border);
    border-left: 3px solid var(--violet);
  }

  .callout--amber {
    background: var(--amber-dim);
    border: 1px solid var(--border);
    border-left: 3px solid var(--amber);
  }

  .callout-label {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--violet-bright);
    background: var(--bg-card);
    border: 1px solid var(--border);
    padding: 0.1875rem 0.4375rem;
    border-radius: 4px;
    flex-shrink: 0;
    margin-top: 2px;
    white-space: nowrap;
  }

  .callout-label--amber {
    color: var(--amber);
  }

  .callout p {
    font-size: 0.875rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.65;
    margin: 0;
  }

  /* ── Two-column ── */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-4);
    margin-bottom: var(--s-6);
  }

  .col-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: var(--s-5);
  }

  .col-card-label {
    margin-bottom: var(--s-4);
  }

  .badge {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 0.1875rem 0.5rem;
    border-radius: 9999px;
  }

  .badge--good {
    color: var(--teal);
    background: var(--teal-dim);
    border: 1px solid var(--teal);
  }

  .badge--avoid {
    color: var(--error);
    background: var(--error-dim);
    border: 1px solid var(--error);
  }

  .check-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    padding: 0;
  }

  .check-list li {
    font-size: 0.875rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.6;
    padding-left: var(--s-4);
    position: relative;
  }

  .col-card--good .check-list li::before {
    content: '✓';
    position: absolute;
    left: 0;
    color: var(--teal);
    font-weight: 700;
  }

  .col-card--bad .check-list li::before {
    content: '×';
    position: absolute;
    left: 0;
    color: var(--error);
    font-weight: 700;
  }

  /* ── Examples ── */
  .example-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }

  .example {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: var(--s-4) var(--s-5);
    display: flex;
    gap: var(--s-4);
    align-items: flex-start;
    transition: border-color 0.15s;
  }

  .example:hover {
    border-color: var(--border-mid);
  }

  .example-tag {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--violet-bright);
    background: var(--violet-dim);
    border: 1px solid var(--border);
    padding: 0.1875rem 0.5rem;
    border-radius: 4px;
    flex-shrink: 0;
    white-space: nowrap;
    margin-top: 2px;
  }

  .example p {
    font-size: 0.875rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.65;
    margin: 0;
    font-style: italic;
  }

  /* ── Feature grid ── */
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-4);
    margin-bottom: var(--s-6);
  }

  .feature-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: var(--s-5);
    transition: border-color 0.15s;
  }

  .feature-card:hover {
    border-color: var(--border-mid);
  }

  .feature-tag {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--violet-bright);
    margin-bottom: var(--s-2);
    text-transform: uppercase;
  }

  .feature-card h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: var(--s-2);
  }

  .feature-card p {
    font-size: 0.875rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.65;
  }

  /* ── Config list ── */
  .config-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
  }

  .config-item {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: var(--s-5) var(--s-6);
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: var(--s-6);
    transition: border-color 0.15s;
  }

  .config-item:hover {
    border-color: var(--border-mid);
  }

  .config-meta {
    display: flex;
    flex-direction: column;
    gap: var(--s-1);
  }

  .config-num {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--violet-bright);
    letter-spacing: 0.06em;
  }

  .config-meta h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
  }

  .config-range {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .config-body p {
    font-size: 0.875rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.65;
    margin-bottom: var(--s-3);
  }

  .config-tip {
    font-size: 0.8125rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.6;
    padding: var(--s-3) var(--s-4);
    background: var(--bg-2);
    border-radius: 4px;
    border-left: 2px solid var(--violet-bright);
  }

  .config-tip strong {
    color: var(--text);
  }

  /* ── Provider table ── */
  .provider-table {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    margin-bottom: var(--s-2);
  }

  .provider-row {
    display: flex;
    gap: var(--s-3);
    align-items: flex-start;
    font-size: 0.875rem;
  }

  .provider-name {
    font-weight: 600;
    color: var(--text);
    min-width: 80px;
    flex-shrink: 0;
  }

  .provider-desc {
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.6;
  }

  /* ── Code block ── */
  .code-block {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--text);
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: var(--s-3) var(--s-4);
    margin: var(--s-2) 0;
    line-height: 1.7;
    white-space: pre-wrap;
  }

  .code-comment {
    color: var(--text-faint);
    display: block;
    margin-bottom: var(--s-1);
  }

  /* ── Event list ── */
  .event-list {
    list-style: none;
    padding: 0;
    margin-top: var(--s-3);
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }

  .event-list li {
    font-size: 0.8125rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.5;
  }

  code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0.1rem 0.35rem;
    color: var(--text);
  }

  /* ── Tier row ── */
  .tier-row {
    display: flex;
    align-items: flex-start;
    gap: var(--s-3);
    margin-bottom: var(--s-8);
  }

  .tier-card {
    flex: 1;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: var(--s-5);
    transition: border-color 0.15s;
  }

  .tier-card:hover {
    border-color: var(--border-mid);
  }

  .tier-label {
    display: block;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    margin-bottom: var(--s-3);
  }

  .tier-novice .tier-label { color: var(--text-muted); }
  .tier-understudy .tier-label { color: var(--teal); }
  .tier-artisan .tier-label { color: var(--amber); }

  .tier-artisan {
    border-color: rgba(251, 191, 36, 0.2);
  }

  .tier-card p {
    font-size: 0.875rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.65;
  }

  .tier-arrow {
    font-size: 1.125rem;
    color: var(--text-faint);
    padding-top: var(--s-8);
    flex-shrink: 0;
  }

  /* ── DNA grid ── */
  .dna-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--s-3);
    margin-bottom: var(--s-6);
  }

  .dna-item {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: var(--s-4);
    display: flex;
    flex-direction: column;
    gap: var(--s-1);
    transition: border-color 0.15s;
  }

  .dna-item:hover {
    border-color: var(--border-mid);
  }

  .dna-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--amber);
  }

  .dna-desc {
    font-size: 0.8125rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.5;
  }

  /* ── Verdict cards ── */
  .verdict-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: var(--s-5);
    transition: border-color 0.15s;
  }

  .verdict-card:hover {
    border-color: var(--border-mid);
  }

  .verdict-card h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
    margin: var(--s-3) 0 var(--s-2);
  }

  .verdict-card p {
    font-size: 0.875rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.65;
  }

  .verdict-badge {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0.2rem 0.55rem;
    border-radius: 9999px;
  }

  .verdict-badge--promote {
    color: var(--teal);
    background: var(--teal-dim);
    border: 1px solid var(--teal);
  }

  .verdict-badge--retire {
    color: var(--rose);
    background: var(--rose-dim);
    border: 1px solid var(--rose);
  }

  /* ── Numbered list ── */
  .numbered-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    padding-left: var(--s-6);
    margin-bottom: var(--s-6);
  }

  .numbered-list li {
    font-size: 0.875rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.65;
  }

  .numbered-list li::marker {
    color: var(--violet-bright);
    font-weight: 600;
    font-family: var(--font-mono);
  }

  /* ── Billing formula ── */
  .billing-formula {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: var(--s-6);
    margin-bottom: var(--s-8);
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }

  .formula-line {
    display: flex;
    align-items: center;
    gap: var(--s-4);
  }

  .formula-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    min-width: 120px;
    flex-shrink: 0;
  }

  .formula-expr {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--text);
  }

  .formula-plus {
    font-size: 1rem;
    color: var(--violet-bright);
    font-weight: 700;
    padding-left: var(--s-2);
  }

  .formula-eq {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--text);
    padding-top: var(--s-3);
    border-top: 1px solid var(--border);
    text-align: right;
  }

  /* ── Guardrail list ── */
  .guardrail-list {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    margin-bottom: var(--s-6);
  }

  .guardrail-item {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: var(--s-5) var(--s-6);
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: var(--s-6);
    align-items: start;
    transition: border-color 0.15s;
  }

  .guardrail-item:hover {
    border-color: var(--border-mid);
  }

  .guardrail-meta {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }

  .guardrail-tag {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--violet-bright);
    background: var(--violet-dim);
    border: 1px solid var(--border);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    letter-spacing: 0.06em;
    width: fit-content;
  }

  .guardrail-meta h3 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text);
  }

  .guardrail-item > p {
    font-size: 0.875rem;
    font-family: var(--font-body);
    color: var(--text-muted);
    line-height: 1.65;
    padding-top: 2px;
  }

  /* ── Footer ── */
  .guide-footer {
    display: flex;
    align-items: center;
    gap: var(--s-4);
    padding: var(--s-12) 0 var(--s-8);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 0.625rem 1.25rem;
    background: var(--violet);
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 4px;
    transition: background 0.15s;
  }

  .btn-primary:hover {
    background: var(--violet-bright);
    color: #fff;
  }

  .btn-ghost {
    font-size: 0.875rem;
    color: var(--text-muted);
    transition: color 0.15s;
  }

  .btn-ghost:hover {
    color: var(--violet-bright);
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .steps-row {
      flex-direction: column;
    }

    .step-arrow {
      padding-top: 0;
      transform: rotate(90deg);
      align-self: center;
    }

    .two-col {
      grid-template-columns: 1fr;
    }

    .feature-grid {
      grid-template-columns: 1fr;
    }

    .config-item {
      grid-template-columns: 1fr;
      gap: var(--s-3);
    }

    .tier-row {
      flex-direction: column;
    }

    .tier-arrow {
      padding-top: 0;
      transform: rotate(90deg);
      align-self: center;
    }

    .dna-grid {
      grid-template-columns: 1fr 1fr;
    }

    .guardrail-item {
      grid-template-columns: 1fr;
      gap: var(--s-3);
    }

    .toc {
      gap: var(--s-2);
    }

    .toc-div {
      display: none;
    }
  }
</style>
