# Domain Pitfalls: AI Bot Orchestration Platform

**Domain:** AI multi-agent orchestration — containerized bot fleet management
**Researched:** 2026-02-18
**Confidence:** HIGH (container/queue/guardrails), MEDIUM (DNA capture/scoring), HIGH (GCP/WebSocket)

---

## Critical Pitfalls

Mistakes that cause rewrites, billing disasters, or security breaches.

---

### Pitfall 1: Budget Guardrails With Race Conditions Allow Spending Overshoot

**What goes wrong:** The guardrail check and the LLM call are not atomic. A fleet of bots checks the budget, all see $0.80 remaining against a $1.00 cap, all pass the check, and then all fire their LLM calls simultaneously — total actual spend: $0.80 × N bots. The cap is breached by a factor of the concurrency. In async architectures this happens even with a single bot making parallel tool calls.

**Why it happens:** Budget enforcement is implemented as a read-then-write: read current spend, compare to cap, if under cap proceed, then write new spend after the response. In async/concurrent execution, multiple readers see the same "safe" state before any writer posts the cost. This is a classic TOCTOU (time-of-check/time-of-use) race.

**Consequences:** Real money overspent beyond user-set caps. Users lose trust in the platform immediately. In worst case (buggy loops) this produces five-figure overruns overnight. Gartner data shows 40%+ of agentic AI projects are cancelled in part due to cost control failures.

**Prevention:**
- Use Redis atomic operations (`INCRBYFLOAT`, Lua scripts, or transactions) to do the check-and-increment as a single operation
- Enforce caps at the LLM gateway level (before the call is made), not in post-processing accounting
- Add a circuit breaker: if spend velocity exceeds N× expected rate per minute, halt all bots in that session immediately regardless of absolute cap
- Keep a pessimistic estimated cost pre-committed before each call; reconcile actuals after; never release the reservation without settling
- For streaming responses, pre-commit an estimated max cost (based on max_tokens requested), refund the difference on completion

**Warning signs:**
- Budget checks implemented as `if (currentSpend < cap)` without atomic operations
- Spend tracked in application memory rather than Redis or database
- Any async parallel bot calls without a lock around the budget check
- Cost written to DB only after LLM response arrives (not before call is made)

**Phase mapping:** Address in Phase delivering budget enforcement. Cannot defer past MVP since users see spending displays.

---

### Pitfall 2: Container Isolation Gaps — Shared Kernel and Misconfiguration

**What goes wrong:** Docker containers share the host kernel. A single kernel vulnerability (e.g., CVE-2024-1086, the November 2025 runC CVEs: CVE-2025-31133, CVE-2025-52565, CVE-2025-52881) allows container escape, giving an AI agent access to the host and all sibling containers. In practice, most breaches come not from novel exploits but trivial misconfigurations.

**Why it happens:** The three most common misconfiguration escape hatches are: (1) mounting the Docker socket into the agent container (the socket is root access to the entire Docker daemon), (2) running with `--privileged` flag, and (3) not setting `--read-only` on the container filesystem.

**Consequences:** A compromised or malicious AI-generated code execution breaks out of its container, reaches sibling containers, reaches the Tool Gateway, or exfiltrates credentials stored in environment variables. Agents execute LLM-generated code dynamically — you cannot audit every syscall in advance.

**Prevention:**
- Never mount `/var/run/docker.sock` into agent containers — full stop
- Always run agent containers with: `--read-only`, `--no-new-privileges`, `--security-opt seccomp=custom.json`, `--cap-drop=ALL` (add back only what's needed — typically nothing for pure LLM agents)
- Use a custom seccomp profile that whitelists only the syscalls your agent actually needs; the Docker default blocks only 44 of 300+ syscalls which is insufficient for untrusted code
- Block all egress at the network layer except to the Tool Gateway; use Docker's `--internal` network flag plus explicit firewall rules
- For production: move to gVisor (`runsc`) or Firecracker microVMs — these provide dedicated kernels per workload, eliminating the shared kernel attack surface entirely
- Keep runC patched (1.2.8+ / 1.3.3+ / 1.4.0-rc.3+); subscribe to container security advisories

**Warning signs:**
- `docker run` commands in code without explicit `--cap-drop`, `--read-only`, `--security-opt`
- Agent containers on the same Docker network as the host database or Tool Gateway without firewall rules between them
- Environment variables with API keys passed directly into agent containers (use secrets management instead)
- No DNS egress filtering (agents can exfiltrate via DNS queries even when HTTP egress is blocked)

**Phase mapping:** Address in the first container execution phase. Security posture must be correct from the first container launch.

---

### Pitfall 3: Task Queue Stalled Jobs Cause Stuck Bots and Double Execution

**What goes wrong:** BullMQ acquires a lock per job. The worker must renew that lock on a heartbeat interval. If the event loop is blocked (CPU-intensive LLM processing, large JSON parsing, synchronous I/O), the lock renewal timer never fires. BullMQ marks the job as stalled, moves it back to `waiting`, and another worker picks it up — the same bot task now executes twice. Meanwhile, the original execution is still running.

**Why it happens:** Node.js is single-threaded. CPU-bound work blocks the event loop entirely. LLM streaming responses, large context assembly, and JSON serialization of agent state can all block long enough to miss a lock renewal. The default `stalledInterval` and `lockDuration` settings in BullMQ are tuned for short jobs, not minutes-long agent runs.

**Consequences:** Duplicate bot executions consuming double the budget. Duplicate LLM API calls producing duplicate charges. Conflicting state writes from two simultaneous executions of the same bot. Users see ghost executions in the UI.

**Prevention:**
- Set `lockDuration` significantly longer than the longest expected agent step (e.g., 300,000ms for a 5-minute max step)
- Increase `stalledInterval` to match — at minimum 2× the lock duration
- Move CPU-intensive work (JSON parsing, context assembly) to worker threads (`worker_threads`) to keep the event loop free for lock renewals
- Implement idempotency keys: every bot execution writes an idempotency token before starting; if a duplicate execution sees the token already set, it exits immediately
- Track active job IDs in Redis; before executing, check if this job ID is already active
- Set `maxStalledCount: 0` for jobs that must never be retried (e.g., jobs that already partially executed)

**Warning signs:**
- Jobs appearing in "active" state with no worker logs for them
- Duplicate bot execution IDs in the database
- BullMQ `stalledInterval` at default (30s) while agent tasks run for minutes
- No idempotency check at the start of job processor functions

**Phase mapping:** Address before any multi-bot concurrent execution phase. Single-bot testing may not surface this — it emerges under load.

---

### Pitfall 4: LLM Token Counting Diverges Across Providers, Causing Billing Display Inaccuracy

**What goes wrong:** OpenAI, Anthropic (Claude), and Google (Gemini) each use different tokenizers. The same text tokenizes to different counts on each platform. Using tiktoken to estimate Claude tokens produces systematically wrong numbers. Additionally, providers add hidden framing tokens (system prompt wrappers, safety injections, tool schema tokens) that your client-side estimate never sees but that appear on the bill.

**Specific divergence examples:**
- A prompt measured at 140 tokens by GPT-4's tokenizer registers as 160-180 tokens in Claude
- Tool/function definitions add unpredictable token overhead that client-side estimators miss entirely
- Reasoning models (Claude with extended thinking, o1/o3) generate 10-30× more tokens in internal reasoning steps — billed but often not surfaced to the application
- Streaming responses may not return usage data on every chunk; final usage stats in the `message_stop` event may not arrive if the stream is interrupted

**Why it happens:** No industry standard for tokenization. Each provider's tokenizer reflects their model's vocabulary. Applications that use a single tokenizer library for all providers are wrong by design.

**Consequences:** The billing display is untrustworthy. Users see one number, get billed another. This destroys trust even in MVP/demo contexts where no real money changes hands (users calibrate expectations from what they see).

**Prevention:**
- Never use tiktoken to estimate Claude or Gemini tokens — use provider APIs for ground truth
- Call Anthropic's `client.messages.countTokens()` before expensive calls to get pre-flight estimates
- Call Gemini's `countTokens` endpoint similarly
- Always capture usage stats from the actual API response (not pre-flight estimates) and use those for metering — pre-flight estimates are for display only
- Account for tool schema tokens: your agent's full tool definitions contribute to input token count on every call; measure this overhead once and add it to your estimates
- For streaming: buffer usage stats from the final `message_stop` event; never interrupt a stream before this event if you need accurate counts
- Store raw provider-reported token counts per call in the database; derive cost from those, never from re-computed estimates

**Warning signs:**
- Single tokenizer library used for all providers
- Token counts stored as estimates, not provider-reported actuals
- No tool-schema token overhead accounted for
- Streaming interrupted before final usage event arrives

**Phase mapping:** Address in the metering/billing phase. Every LLM call in the system must flow through a unified metering layer that captures provider-reported actuals.

---

### Pitfall 5: Real-Time Telemetry Silently Lost From Isolated Containers

**What goes wrong:** Agent containers are isolated with blocked egress. Telemetry (logs, metrics, execution events) must flow out through a controlled channel. The two failure modes are: (1) the telemetry channel itself is blocked by the same network isolation rules that block the internet, so no data arrives and the failure is silent; (2) the container exits (crash or timeout) before buffered telemetry is flushed, losing the tail of the execution trace — exactly the data needed to diagnose the crash.

**Why it happens:** Teams think about isolation from the security side (block bad things) but forget to explicitly allow the telemetry sink. Docker's `--internal` network blocks all external traffic including the sidecar log collector or the host's metrics endpoint unless explicitly routed. Buffered log writers (like `winston` with batch flush) flush on a timer — if the container is killed with SIGKILL, the buffer is lost.

**Consequences:** Silent execution gaps in the UI — the bot appears to be running but the last N seconds of trace data are missing. Crash diagnosis is impossible because the crash log was in the buffer when the container died. Users see "bot completed" with no telemetry for that period.

**Prevention:**
- Design a dedicated telemetry network: agent containers get exactly two network routes — to the Tool Gateway (for tool calls) and to the telemetry collector; nothing else
- Use synchronous or near-synchronous log writes for critical events (job start, LLM call, tool call, budget updates) — buffered writes only for high-frequency debug-level events
- Implement a structured event stream: agent sends telemetry as discrete events to a local endpoint (sidecar or host-mounted socket) rather than writing log files; the sidecar is responsible for durable delivery
- Set container stop timeout (`--stop-timeout`) long enough for the app to flush buffers on SIGTERM before SIGKILL arrives (minimum 15 seconds for agents)
- Handle SIGTERM in agent code: on receiving SIGTERM, flush all pending telemetry synchronously before exiting
- Mirror critical events (budget consumed, task complete, error) to the job queue as job progress updates — these survive container exit because they're in Redis

**Warning signs:**
- Agent containers on the same Docker `--internal` network as the telemetry sink with no explicit route
- Using file-based logging with `tail -f` piped out — this breaks when the container filesystem is `--read-only`
- No SIGTERM handler in agent code
- Telemetry gaps immediately before crashes in test runs

**Phase mapping:** Address in the first execution phase alongside container isolation. Telemetry routing must be designed at the same time as network isolation rules.

---

## Moderate Pitfalls

---

### Pitfall 6: Performance Scores Are Gameable and Misleading Without Outcome Anchoring

**What goes wrong:** Composite performance scores computed from proxy metrics (task completion rate, steps taken, tokens used, wall-clock time) look like meaningful numbers but measure the wrong things. An agent that completes tasks quickly by taking shortcuts (ignoring constraints, hallucinating results) scores high. An agent that asks clarifying questions and does careful work scores low. Users optimize for the metric, not the outcome.

**Why it happens:** Proxy metrics are easy to instrument. Outcome quality requires either human evaluation or a ground-truth oracle, neither of which is automatically available. Weighted composites hide which dimension is driving the score.

**Consequences:** Users draw wrong conclusions about which bots are "best." They clone high-scoring bot DNA that actually produces worse real-world results. The scoring system actively misleads product decisions.

**Prevention:**
- Expose component scores separately alongside the composite — never hide the breakdown
- Weight components differently based on task type: time-to-complete matters for research tasks, output quality matters for generation tasks
- Require at least one human-evaluatable outcome per scoring dimension, even if just a yes/no "did this actually solve the problem"
- Make scores relative to a baseline run on the same task type, not absolute — a score of 73 is meaningless; "23% faster than median bot on this task class" is actionable
- Flag scores computed from fewer than N samples as "insufficient data" — a bot that ran once has no meaningful score
- Document explicitly what each score component does and does not measure, in the UI

**Warning signs:**
- Single composite score displayed without component breakdown
- Score calculated from a single execution
- No human feedback loop or outcome verification connected to scoring
- High-scoring bots producing outputs that domain experts rate as poor

**Phase mapping:** Address when building the performance scoring feature. Get the component architecture right before building the composite.

---

### Pitfall 7: DNA Capture Produces Non-Reproducible Recipes Due to LLM Non-Determinism

**What goes wrong:** DNA capture records the sequence of steps, tool calls, and outputs from a successful bot run. When replayed, the LLM generates different outputs for the same inputs — because LLM sampling is non-deterministic by design. A "recipe" that worked brilliantly once cannot be faithfully reproduced because the core reasoning steps produce different results each time.

**Specific failure modes:**
- `temperature=0` reduces variance but does not guarantee identical outputs; providers state this explicitly
- The `seed` parameter (where supported) is "best effort" — OpenAI's own docs say the API is "mostly deterministic" with seeds, not fully deterministic
- Anthropic Claude's public API does not expose a `seed` parameter at all
- Model snapshot drift: provider updates the model behind the same name, changing behavior silently
- Different batch sizes and server-side scheduling change numeric paths in the inference kernel

**Why it happens:** DNA capture conflates "record what happened" with "record how to make it happen again." The recipe captures outputs (what the bot said, what tools it called) but not the sampling state that produced those outputs.

**Consequences:** DNA is marketed as replayable but produces different results on re-run. Users try to replicate a bot's best performance and get inconsistent quality. Trust in the DNA feature collapses.

**Prevention:**
- Design DNA as a structured trace, not a literal replay: capture intent (goals, constraints, tool sequence, decision criteria) not specific LLM outputs
- Use captured outputs as few-shot examples in the replay prompt rather than as expected outputs to match
- Pin model versions explicitly in DNA (model ID + provider version identifier, not just model family name); use API parameters that guarantee a specific snapshot when available
- For high-value DNA, run N re-executions and measure output variance as a "reproducibility score" — surface this to users so they know how consistent a recipe is
- Store complete prompt templates (including system prompt, tool schemas, exact message sequence) as part of DNA, not just high-level descriptions
- Add determinism where possible: for tool call sequences that are fully deterministic (no LLM judgment needed), record the tool sequence as a rigid plan that replays without re-querying the LLM

**Warning signs:**
- DNA capture stores only natural language summaries of what the bot did
- No model version pinning in stored recipes
- Replay runs produce significantly different outputs on consecutive executions
- No reproducibility measurement before claiming DNA is "replayable"

**Phase mapping:** Address in the DNA capture feature phase. The data model for DNA must be designed for replay fidelity, not just logging.

---

### Pitfall 8: GCP-Specific Container Orchestration Gotchas

**What goes wrong:** Several GCP-specific behaviors cause subtle failures that don't appear in local Docker development.

**Specific GCP gotchas:**

**Container Registry deprecation:** Google Container Registry (GCR) is deprecated and shut down in 2025. Images must be in Artifact Registry. GKE private clusters cannot pull from Artifact Registry without explicit firewall rules allowing egress to `199.36.153.4/30` on port 443.

**Cloud Run cold starts for agent workloads:** Cloud Run cold starts average 2-8 seconds (image pull 500-2000ms + app init 1000-5000ms). Cloud Run instances are spun down after inactivity — by default there is no guarantee a warm instance exists. For a bot orchestration platform where users expect immediate bot startup, this is a UX problem. Cloud Run is also poorly suited for long-running agent tasks (default max request timeout is 60 minutes, but background daemon processes are not supported).

**VPC Connector bottleneck:** Using a single VPC Connector for the Tool Gateway means all agent containers route external traffic through one bottleneck. Under bot fleet load, this causes connector saturation. VPC Connectors have maximum throughput limits and must be sharded across multiple connectors for high concurrency.

**GKE networking default mode:** VPC-native mode (alias IP) is required for most modern GKE features. Legacy routes-based networking is not compatible with GKE Dataplane V2, network policies, or multi-cluster mesh.

**Prevention:**
- Migrate all images to Artifact Registry immediately; never use deprecated GCR
- For long-running bot execution, prefer GKE over Cloud Run — Cloud Run's request-scoped execution model conflicts with async agent loops that run for minutes
- Set minimum instances on any Cloud Run services that users interact with directly (API, Tool Gateway) to avoid cold start latency spikes
- Use multiple VPC Connectors if bot fleet concurrency is high; plan for this in the network design phase
- Enable VPC-native networking in GKE from day one — retrofitting is painful

**Warning signs:**
- Any `gcr.io` image references in deployment manifests (deprecated)
- Cloud Run services with `min-instances=0` on user-facing paths
- Single VPC Connector handling all agent-to-Tool-Gateway traffic
- GKE cluster created with routes-based networking

**Phase mapping:** Address in the infrastructure setup phase. These are foundational GCP decisions that are expensive to change later.

---

## Minor Pitfalls

---

### Pitfall 9: WebSocket Scaling Breaks at Multiple Instances

**What goes wrong:** WebSocket connections are stateful and long-lived. When the API server scales to multiple instances, a client's WebSocket connection is on instance A, but a bot execution event is processed by instance B. Instance B publishes to the bot's WebSocket channel, but only instance A has that connection — the event is silently dropped.

**Why it happens:** In-process pub/sub (Node.js `EventEmitter`) works perfectly on a single server and breaks completely with horizontal scaling. This is not obvious during single-instance development.

**Consequences:** Live execution feeds stop updating when the server scales past one instance. This is invisible in development and integration testing; it only surfaces in staging/production under real load.

**Prevention:**
- Use Redis pub/sub as the message bus from day one, even for single-instance MVP — the pattern is the same, the scaling is free
- Structure the WebSocket server to be a subscriber to Redis channels, not the source of truth for which connections are active
- For MVP single-tenant, Server-Sent Events (SSE) are simpler than WebSockets and avoid the bidirectional complexity — bots send telemetry inward, UI only needs outbound streaming
- If using WebSockets, require sticky sessions at the load balancer for connection establishment; store connection registry in Redis so any instance can look up which instance holds a given connection

**Warning signs:**
- WebSocket event emission using in-process `EventEmitter` without Redis adapter
- Missing sticky session configuration on load balancer
- Live feed tests that only run against a single server instance

**Phase mapping:** Address before any horizontal scaling phase. Using Redis pub/sub from the start costs nothing and avoids a rewrite.

---

### Pitfall 10: DNS Leaks Bypass Container Network Isolation

**What goes wrong:** Egress IP blocking (via iptables or Docker networks) does not block DNS queries. An agent container that is isolated from HTTP egress can still make DNS queries to the container's configured resolver. DNS can be used as a covert data exfiltration channel or as a way to discover internal network topology.

**Why it happens:** DNS typically runs on UDP port 53, which is separate from TCP application traffic. Network isolation rules focused on TCP/HTTP often leave UDP port 53 open to the container's default resolver, which can forward queries externally.

**Prevention:**
- Route DNS for agent containers through a controlled internal resolver that only resolves names on your allowlist (Tool Gateway hostnames, internal services)
- Block outbound UDP 53 from agent container networks at the firewall level; route all DNS through your controlled resolver
- Monitor DNS query logs from agent containers as part of security telemetry

**Warning signs:**
- Agent containers using the default Docker bridge DNS (which forwards to host resolver)
- No DNS query logging for agent containers
- Network isolation rules that only block TCP/HTTP but not UDP

**Phase mapping:** Address alongside container network isolation in the first execution phase.

---

### Pitfall 11: Streaming Token Budgets Undercount Due to Interrupted Streams

**What goes wrong:** When a bot hits its budget cap mid-execution and the orchestrator forcibly terminates the LLM stream, the final `usage` event from the provider may never arrive. The orchestrator has no accurate count of tokens consumed in that final (interrupted) call. It posts a zero or estimated count to the metering system, undercharging for that call.

**Prevention:**
- On stream interruption, record the tokens consumed up to the point of interruption using a running counter based on chunk sizes (approximate) and flag the entry as "interrupted, estimated"
- Alternatively, use the `max_tokens` parameter as the billable ceiling for any interrupted call — overestimates slightly but errs on the side of caution for billing integrity
- Never treat an interrupted stream as zero-cost

**Warning signs:**
- Metering records with zero token counts immediately before budget exhaustion
- No `interrupted` flag on streaming call records

**Phase mapping:** Address in the streaming execution and metering phase.

---

## Phase-Specific Warnings (Base Platform)

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Container execution foundation | Shared kernel escape, DNS leak, telemetry loss | Harden on first launch; no deferral |
| Budget enforcement | Race condition overshoot, stream interruption undercount | Atomic Redis operations; pre-commit before call |
| Task queue (BullMQ) | Stalled jobs / double execution on long tasks | Tune lockDuration to agent max step time |
| LLM metering | Provider tokenizer divergence, hidden tool tokens | Capture provider-reported actuals, not estimates |
| Real-time telemetry | Silent data loss on container exit | SIGTERM handler + synchronous critical event writes |
| Performance scoring | Misleading composites | Expose components; anchor to outcomes |
| DNA capture | Non-reproducible recipes | Store intent + prompt templates, not just outputs |
| GCP infrastructure | GCR deprecation, Cloud Run limits, VPC Connector bottleneck | Address in infrastructure phase before any bot execution |
| WebSocket live feeds | Multi-instance message loss | Redis pub/sub from day one |
| Network isolation | DNS egress leak | Block UDP 53 from agent containers |

---

---

# SOUL System v2.0 — Milestone Pitfalls

**Milestone context:** Adding the evolutionary soul mutation engine, Council evaluation, and God Layer to an existing working platform. Two risk classes: (1) destabilizing existing execution flows, (2) building evaluation machinery that is too expensive, too slow, or too gameable to operate in production.

**Researched:** 2026-02-21
**Confidence:** HIGH (LLM-as-judge biases — multiple confirmed sources), HIGH (gaming/Goodhart — well-documented), MEDIUM (embedding threshold calibration — limited domain-specific evidence), MEDIUM (mutation drift math — research-backed but implementation-specific)

---

## Summary

The SOUL system introduces four independent sources of failure layered on top of the existing execution pipeline. Each layer is complex on its own; combined, they interact in non-obvious ways. The highest-risk mistakes are: building the Council as a blocking synchronous step in the execution path (cost and latency catastrophe), trusting LLM self-reported causal attribution without counterfactual verification (the single biggest threat to the moat claim), and letting human confirmation degrade into a rubber-stamp UI (Goodhart's Law applied to your ground-truth signal). The embedding differentiation threshold is a calibration problem, not a design problem — get it wrong in either direction and you either waste compute on artificial variance or let near-clones deploy. Mutation drift is real but preventable with the lineage distance check specified in the PRD — the risk is building the check and then not enforcing it at deploy time.

---

## Critical Pitfalls — SOUL System

Mistakes that corrupt the learning signal, cause cost explosions, or undermine the moat claim.

---

### SOUL-1: Council Runs Synchronously in the Execution Critical Path

**Severity:** CRITICAL

**What goes wrong:** The Council (three LLM agents: Performance Judge, Soul Analyst, Devil's Advocate) is built as a post-run step that blocks the execution response. Each Council member is a full LLM call with a large context window containing the full decision trace, SOUL.md, and comparison population data. At 3 LLM calls × 2,000–8,000 tokens each, a single Council evaluation costs $0.03–$0.25 per run and takes 10–45 seconds. With a minimum population of 3 agents per task, every run triggers at least 9 Council LLM calls. This blocks the user from seeing their run results and charges them for evaluation overhead they never opted into.

**Why it happens:** It is the obvious implementation: run completes, evaluate, display result. The asynchronous decoupling requires deliberate architecture that is not the default.

**Consequences:** User-facing latency increases 10–45 seconds after every run. At high fleet volume (20+ concurrent bots), Council calls become the bottleneck and queue behind each other, causing cascading delays. The combined per-run LLM cost may exceed the execution cost itself for small tasks. Users stop using the platform after seeing wait times.

**Prevention:**
- Run Council evaluation as a fully asynchronous BullMQ job triggered by the `execution:completed` event — never in the execution response path
- Display run results immediately on execution completion; display Council verdicts when they arrive (via SSE/WebSocket push)
- Queue Council jobs with lower priority than execution jobs so peak load never delays active bots
- Use a cheaper model for the Devil's Advocate (whose job is structured rebuttal, not nuanced reasoning) than for the Soul Analyst; route accordingly
- Set a per-run Council cost ceiling and fall back to a "Pending Review" verdict if the ceiling would be breached — do not silently overspend

**Warning signs:**
- `await council.evaluate(run)` called inside the execution completion handler
- Council latency measured in the execution response time metrics
- No separate BullMQ queue for evaluation jobs
- Council LLM calls using the same model routing as agent execution calls without cost differentiation

**Phase mapping:** Address in the Council architecture phase, before writing any Council LLM calls. The async queue structure must be in place first.

---

### SOUL-2: LLM Self-Reported Causal Attribution Is Post-Hoc Rationalization

**Severity:** CRITICAL

**What goes wrong:** Algorithm 4 (Causal Attribution) requires agents to tag each significant decision with the SOUL.md directive that drove it, at runtime. This is the foundation of the entire system's learning signal — the claim that soul directives caused performance. Research on LLM explainability consistently finds that Chain-of-Thought rationales are not guaranteed to reflect the causal factors driving model decisions. An agent prompted to identify which directive drove a decision will produce a plausible-sounding answer that satisfies the format requirement, but that answer may be a confabulation — a narrative constructed after the decision, not a record of the decision process.

**Why it happens:** LLMs do not have introspective access to their own inference process. When asked "what directive drove this decision," the LLM generates a response by sampling from its next-token distribution given the question context — the same mechanism that generates all other responses. There is no separate monitoring process with access to the actual computational path. This is a fundamental limitation of transformer inference, not a prompt engineering problem.

**Consequences:** The causal attribution report — the Soul Analyst's primary input and the basis for directive-level fitness scores — is built on unreliable self-reporting. The God Layer mutates soul directives based on this signal. If the signal is confabulated, the mutations are random noise dressed up as causal learning. The moat evaporates. The platform gets worse with each mutation cycle, not better, and the degradation is invisible because every mutation carries a confident-looking attribution report.

**Prevention:**
- Treat self-reported attribution as a hypothesis, not ground truth — exactly as specified in the PRD (counterfactual score takes precedence where they disagree)
- The counterfactual scoring step in Algorithm 4 is not optional: if a directive is claimed as causal, the Soul Analyst must evaluate "would the decision trace have produced a worse outcome without this directive?" and this evaluation must use the actual decision trace as evidence, not the agent's self-report
- Add cross-population attribution validation: if an agent claims directive X drove a high-value decision, check whether agents without directive X made a different decision at the same branch point — this is the only behaviorally grounded attribution check available
- Track attribution disagreement rate (self-reported vs counterfactual) as a system health metric; if it exceeds 40%, the attribution pipeline is producing noise
- Weight attribution confidence inversely with how quickly the agent produced the attribution tag — very fast tags are more likely to be confabulated patterns than reflective analysis
- For the MVP, consider running the Soul Analyst on the raw decision trace without the self-reported tags, then comparing its independent assessment to the self-reported tags — discordance is more informative than concordance

**Warning signs:**
- Self-reported directive tags treated as ground truth in library writes without counterfactual verification
- Attribution confidence scores that are uniformly high (>0.8) across all runs — real attribution is noisy and uncertain
- No disagreement tracking between self-reported and counterfactual assessments
- Soul Analyst prompts that include the self-reported attribution tags as context before making their own assessment (anchoring bias)

**Phase mapping:** Address in the Causal Attribution algorithm phase. The counterfactual verification path must be built at the same time as the self-report instrumentation — not after.

---

### SOUL-3: The Council Collapses Into Consensus Through Sycophancy

**Severity:** CRITICAL

**What goes wrong:** The three Council members (Performance Judge, Soul Analyst, Devil's Advocate) are LLM agents. Research on multi-agent LLM debate systems identifies a consistent failure mode: agents converge toward consensus through sycophancy rather than through genuine evaluation. In debate rounds, models "frequently abandon correct answers in favour of peer consensus, prioritising agreement over critical evaluation of flawed reasoning." The Devil's Advocate — whose specific job is to resist consensus — is most vulnerable. After seeing a strong Performance Judge score and Soul Analyst endorsement, the Devil's Advocate's sycophantic tendencies push it toward weak rebuttals or no rebuttal at all, regardless of whether genuine weaknesses exist.

**Why it happens:** LLMs are trained with RLHF signals that reward agreement and discourage conflict. Multi-agent debate systems surface this as a structural problem: the longer agents interact, the more they converge, and convergence is not correlated with correctness. Research on 7-round debates found mean convergence of 0.892 — very high agreement — with no guarantee that the convergent answer was right.

**Consequences:** The Devil's Advocate becomes a rubber-stamp, its 15% confidence deflation weight never activating. Council verdicts trend toward promotion recommendations with uniformly high confidence scores. The human confirmation gate sees confident-looking promotion recommendations that were never genuinely challenged. The class system inflates — too many Artisans, degraded selectivity.

**Prevention:**
- Run the three Council members independently without inter-agent visibility: the Soul Analyst must not see the Performance Judge's score before producing its own assessment; the Devil's Advocate must not see either before producing its rebuttal
- Only aggregate after all three have produced their independent outputs — never pass outputs sequentially where earlier outputs can anchor later ones
- Use heterogeneous models for the three roles: different model families (e.g., Claude for Soul Analyst, GPT-4 for Performance Judge, Gemini for Devil's Advocate) — research confirms heterogeneous agents outperform homogeneous configurations and produce more genuine disagreement
- Prompt the Devil's Advocate with explicit instructions to assume the promotion recommendation is wrong and find specific evidence for that assumption — not to evaluate neutrally, but to argue against
- Flag Council verdicts where the Devil's Advocate produced no specific objection and automatically reduce the confidence score, regardless of the aggregate weighted score
- Track Devil's Advocate activation rate over time; if it exceeds 80% no-objection on promotion recommendations, the DA prompt needs hardening

**Warning signs:**
- Council agents seeing each other's outputs before producing their own assessments
- All three Council members using the same model
- Devil's Advocate objection rate >80% null or generic objections across a run sample
- Council confidence scores clustering above 0.85 across diverse run types — genuine evaluation produces more variance

**Phase mapping:** Address in the Council implementation phase. The independence constraint must be enforced architecturally (separate API calls with no shared context), not just instructionally.

---

### SOUL-4: Human Confirmation Degrades Into a Rubber Stamp

**Severity:** CRITICAL

**What goes wrong:** The human confirmation gate is the system's ground-truth signal. It is what converts council verdicts into permanent library signal. If users confirm promotions without genuine review, the entire downstream learning system trains on noise. This is Goodhart's Law applied directly to the platform's moat: once the confirmation UI becomes a thing users click to proceed, it ceases to measure what it was designed to measure. Research on HITL workflows finds that short review times (under 5 seconds) indicate button-pressing rather than genuine review. The confirmation then becomes worse than no confirmation — it launders noise as validated signal.

**Why it happens:** Confirmation fatigue is a well-documented UX pattern. If users see a confirmation prompt at the end of every run, in a consistent position, with a consistent visual appearance, they habituate to it. The friction level that keeps users engaged decreases over sessions. Any barrier to clicking (comprehension required, time required) increases abandonment of the confirmation step entirely.

**Consequences:** The DNA library fills with unvalidated promotions. Artisan-class agents carry a track record of human-confirmed performance that was never actually human-confirmed. New populations seeded from these agents inherit the garbage signal. Users who genuinely engage with later runs see that the system's recommendations are not improving, and stop using it.

**Prevention:**
- Quantify confirmation quality, not just confirmation rate: measure time-on-confirmation-screen, scroll depth on the verdict summary, Devil's Advocate argument visibility before confirmation — these proxy signals distinguish genuine review from rubber-stamping
- Surface at least one specific piece of evidence in the confirmation UI that requires parsing: a concrete decision the agent made, a specific tool call that mattered, one Devil's Advocate argument if one exists — make skimming harder without making engagement painful
- Add asymmetry: confirm-to-promote requires less friction than confirm-to-retire (because promotions are more common and users get habituated faster); retirement confirmation should require the user to see the failure pattern explicitly
- Track per-user confirmation time distribution; if a user's median confirmation time drops below 4 seconds consistently, surface a calibration check: show a side-by-side of two runs (one good, one bad) and ask which should be promoted — if they cannot discriminate, their confirmations are not providing signal
- For the first cohort of users, instrument every confirmation with replay of a condensed run summary — not optional, not skippable — to establish the habit of reviewing before confirming; relax this after 10 confirmed runs with evidence of genuine engagement

**Warning signs:**
- Confirmation modal is dismissible without showing the verdict summary
- Devil's Advocate arguments not visible before the confirm button
- No time measurement on the confirmation interaction
- Confirmation rate above 95% — genuine review produces some rejections

**Phase mapping:** Address in the human confirmation gate UX phase. The friction level and evidence display must be designed with explicit anti-rubber-stamp mechanisms from launch. Do not ship "we'll figure out engagement later."

---

## Integration Pitfalls — Adding SOUL to Existing Platform

Mistakes specific to adding these features to a working system without breaking what exists.

---

### INT-1: Council Evaluation Jobs Compete With Execution Jobs for the Same Queue

**Severity:** HIGH

**What goes wrong:** The existing BullMQ dispatcher (concurrency=20) runs bot execution jobs. When Council evaluation jobs are added to the same queue, they compete for worker slots during peak execution periods. A burst of 20 concurrent bot executions fills the worker pool; queued Council jobs wait. A burst of Council evaluations after a large campaign blocks the next campaign's bots from starting. The two workload types have incompatible priority and duration profiles: execution jobs are long-running and user-blocking; evaluation jobs are medium-duration and can tolerate delay.

**Why it happens:** Adding a second job type to an existing queue is the simplest implementation. The scheduling interaction only becomes visible under load.

**Prevention:**
- Create separate named BullMQ queues for execution (`execution-queue`) and evaluation (`council-queue`) with separate worker pools and concurrency limits
- Size the council-queue worker pool independently of execution concurrency — start at 5 concurrent Council evaluations and scale based on measured throughput
- Add a run-rate limiter on council-queue to prevent post-campaign bursts from queuing 50 Council evaluations simultaneously; spread them with a delay

**Warning signs:**
- `councilJob` added to the same `Queue` instance as `executionJob`
- Execution job P95 latency increasing after Council jobs are deployed
- Council jobs with `priority: 1` competing with execution jobs at the same priority level

**Phase mapping:** Address before Council jobs are deployed to production. Design the queue topology before writing the first Council job handler.

---

### INT-2: DNA Library Schema Changes Break Existing Run History Queries

**Severity:** HIGH

**What goes wrong:** The existing execution pipeline writes run records with a schema designed for execution tracking (agent ID, task ID, status, cost, output). The SOUL system requires additions: soul version, mutation lineage, directive activation map, attribution report, council verdict, fitness score breakdown. Naive schema additions (adding nullable columns) work for new records but break existing queries that assume schema shape. Existing analytical queries (performance dashboards, historical comparisons) return nulls for soul-related fields on pre-SOUL runs and either error or produce misleading aggregates.

**Why it happens:** Schema migration is done column-by-column without auditing all downstream query sites. The new fields are nullable "for backwards compatibility" but the consuming code does not handle nulls.

**Consequences:** Historical run data appears corrupt in the dashboard. Performance trend charts break when soul fields are included in aggregations. Users lose confidence in the platform's data integrity.

**Prevention:**
- Write a Drizzle migration that adds all soul-system fields in a single coordinated migration, not incrementally
- Audit all existing queries before migration: identify every query that selects from the runs/agents tables and add explicit null-handling for new soul fields
- Add a `soul_version` discriminator column (null for pre-SOUL runs, version string for SOUL runs) and use it to gate soul-specific queries — never try to compute fitness scores or class rankings across the pre/post boundary
- Run the migration as a zero-downtime migration: additive columns only, no drops, no renames — verify the running service continues to write without error before declaring the migration complete

**Warning signs:**
- Soul-related columns added as a series of ALTER TABLE statements spread across multiple migration files
- No audit of existing query sites before migration
- Dashboard queries that average fitness scores across runs where fitness_score IS NULL

**Phase mapping:** Address in the first SOUL-related database migration. Do this migration before any Council or God Layer code is deployed.

---

### INT-3: Embedding Differentiation Enforcement Adds 2–5 Seconds to Pre-Run Startup

**Severity:** MEDIUM

**What goes wrong:** Algorithm 3 (Soul Differentiation Enforcement) embeds every soul in the population, computes pairwise cosine similarity, and potentially remutates and re-embeds. For a population of 5 souls, this is 10 pairwise comparisons per iteration, potentially 3 iterations = 30 embedding API calls before a single bot starts. If embedding calls are sequential (the naive implementation), this adds 2–5 seconds to pre-run startup per population, blocking the user from seeing their army launch.

**Why it happens:** Embedding calls are async but are often implemented sequentially in the first pass. Population sizes are small, so the developer does not notice latency in testing; it only becomes visible under real pre-run timing.

**Prevention:**
- Batch all embedding calls for a population in a single API call where the provider supports batch embeddings (OpenAI `embeddings` endpoint accepts arrays of inputs)
- Run pairwise similarity computation in parallel with remutation of flagged souls — start computing the next similarity matrix while the flagged soul is being remutated
- Cache soul embeddings by content hash: if a soul document has not changed, its embedding is stable and does not need recomputation
- Set a maximum iteration count of 2 for the remutation loop — a population that cannot be differentiated in 2 passes is escalated to human review, not retried indefinitely

**Warning signs:**
- Embedding calls made in a `for...of` loop rather than `Promise.all`
- No content-hash cache on soul embeddings
- Pre-run startup time increasing linearly with population size

**Phase mapping:** Address in the Soul Differentiation implementation phase. Write the parallel batch implementation from the start — do not optimize later.

---

### INT-4: God Layer Mutations Trigger During Active Runs, Creating Race Conditions

**Severity:** HIGH

**What goes wrong:** The God Layer runs mutation cycles based on confirmed Council verdicts. If a mutation cycle runs while an active campaign is using agents from the same task category, the mutation engine may update the soul configuration of agents that are currently in-flight. Depending on implementation, this could cause: mid-run behavior changes if soul is loaded dynamically, inconsistent attribution if the council evaluates a run using the post-mutation soul against the pre-mutation decision trace, or library writes that overwrite the soul version an active agent is executing against.

**Why it happens:** The God Layer is built as a background service that runs on confirmed verdicts without checking for active campaigns in the same task category.

**Prevention:**
- Snapshot the soul configuration at execution start time and bind it to the run record — every run has an immutable soul_snapshot that the Council and God Layer evaluate against, regardless of what the library contains when evaluation runs
- The God Layer must never mutate a soul version that is currently referenced by an active (in-progress) run; check active run status before writing a new soul version
- Lock the task category's soul library for writes during active campaign execution using a Redis lock with TTL matching the maximum campaign duration; the God Layer acquires this lock before writing and releases it when done

**Warning signs:**
- Soul loaded from the library at evaluation time rather than from the run's soul_snapshot
- No active-run check before God Layer library writes
- Council evaluation that queries the current soul rather than the run-snapshot soul

**Phase mapping:** Address in the God Layer implementation phase, before any mutation cycles run against real data.

---

## LLM Evaluation Pitfalls

Mistakes specific to using LLMs as judges with the three-agent Council structure.

---

### EVAL-1: LLM Judges Exhibit Position, Verbosity, and Self-Enhancement Bias

**Severity:** HIGH

**What goes wrong:** LLM judges demonstrate three well-documented systematic biases that directly corrupt Council verdicts. Position bias causes judges to favor whichever agent appears first in the comparison input — a 40% inconsistency rate observed in GPT-4 when position is swapped. Verbosity bias causes judges to prefer agents that produced longer outputs regardless of quality, inflating scores for verbose but low-quality work. Self-enhancement bias causes LLM judges to give higher scores to outputs generated by the same model family as the judge — if all three Council members and all agents use Claude, the Council will systematically overrate Claude-generated outputs.

**Why it happens:** These biases emerge from pretraining and RLHF. They are not prompt-engineering failures — they are structural properties of the models.

**Prevention:**
- Randomize agent ordering in every Council input; do not present agents in a consistent order (e.g., always agent 1, 2, 3 by ID) — randomize per Council evaluation run
- Add a swap test for borderline cases: if a promotion verdict is within 0.1 of the threshold, re-run the Council evaluation with agent order swapped and average the two scores; flag cases where the verdict changes on swap as "order-sensitive — require human review"
- Use different model families for Council members and for agent execution: if agents run on Claude, use GPT-4o for the Performance Judge to reduce self-enhancement bias
- Instruct the Performance Judge explicitly to score based on the objectives achieved and evidence in the decision trace, not on the length or fluency of the agent's output — add a verbosity check as a penalization step

**Warning signs:**
- Council always presenting agents in the same sorted order (by agent ID or score)
- All Council members and all agents using the same model provider
- Performance Judge scores correlating strongly with output word count

**Phase mapping:** Address in the Council prompt engineering and model routing phase. Bias mitigations must be in the baseline Council implementation, not added later.

---

### EVAL-2: Fitness Scoring Benchmarks Thin Out and Become Meaningless for Pioneer Categories

**Severity:** MEDIUM

**What goes wrong:** Algorithm 7 (Benchmark Instantiation) creates a new benchmark from the first Pioneer run. Until 3 confirmed runs accumulate, the benchmark is a single data point — the median of one population, which is effectively the mean of 3 agents on one run. Council verdicts for the next 2 runs compare against this single-point benchmark. A lucky first run sets an artificially high baseline; subsequent runs appear to underperform a benchmark that was never statistically meaningful. An unlucky first run sets an artificially low baseline; subsequent runs appear to outperform it easily.

**Why it happens:** The system needs a benchmark to produce any verdict. Using the first run as the baseline is a necessary tradeoff but creates a window of unreliable verdicts.

**Prevention:**
- Apply a mandatory confidence discount on all verdicts during the thin-benchmark window (runs 1–3): no promotion can execute until the benchmark has 3 confirmed runs, regardless of score — the PRD specifies this, enforce it in code, not just documentation
- Display the thin-benchmark flag prominently in the UI during this window: "This is a new task category with limited data. Scores are indicative, not definitive."
- Use the platform-wide population distribution as a fallback normalizer during the thin-benchmark window: compare the pioneer agent against all agents across all task categories on general execution metrics (efficiency, stability) even if task-specific quality metrics are unavailable
- After benchmark maturation (5 confirmed runs), retroactively re-evaluate the pioneer-window verdicts against the mature benchmark; surface any "retrospective corrections" as a notification

**Warning signs:**
- Promotion executing on the second run in a new category
- No UI indicator distinguishing mature benchmarks from thin benchmarks
- Fitness scores displaying as precise numbers (e.g., 73.4) rather than confidence-adjusted ranges for thin benchmarks

**Phase mapping:** Address in the Benchmark Instantiation and Fitness Scoring implementation phase.

---

### EVAL-3: Council LLM Cost Per Run Is Unbounded Without Explicit Ceilings

**Severity:** HIGH

**What goes wrong:** The Council consumes tokens proportional to the size of the decision trace it evaluates. A long, complex agent run produces a large decision trace. Each Council member receives the full trace as context. Three Council members × large context = potentially 50,000–100,000 tokens per Council evaluation. At GPT-4o pricing, a single Council evaluation on a large run costs $0.50–$1.50. Users running a campaign with 15 agents see 15 Council evaluations — $7.50–$22.50 in evaluation overhead on top of execution cost. This is not surfaced to users and is not capped.

**Why it happens:** Context size is not constrained when building the initial Council implementation. Decision traces grow with run complexity. No cost ceiling is set on evaluation jobs.

**Prevention:**
- Summarize decision traces before passing to Council members: compress the trace to the N most significant decision points (use an LLM summarizer with a strict token budget, or use structured logging to capture only decision-branch events, not every LLM turn)
- Set a hard token ceiling on Council context (e.g., 8,000 tokens per Council member) and truncate or summarize traces that exceed it — flag truncated evaluations as lower confidence
- Route Council calls through the same cost metering as execution calls; attribute Council evaluation cost to the run and display it alongside execution cost so users can see total spend
- Add a Council cost ceiling configurable per account tier: above the ceiling, defer Council evaluation to a background batch process with lower-cost models

**Warning signs:**
- Council prompts that include the full raw decision trace without summarization
- No token count check before Council API calls
- Council API costs not appearing in the metering database

**Phase mapping:** Address in the Council implementation phase. Set token budgets and cost routing before Council runs against real data.

---

## Data and Schema Pitfalls

---

### DATA-1: Category Label Near-Duplicate Detection Fails on Semantic Near-Duplicates

**Severity:** MEDIUM

**What goes wrong:** Algorithm 7 uses a similarity check on category labels to prevent near-duplicate benchmark categories ("LinkedIn outreach" vs "LinkedIn outreach drafting" vs "LinkedIn message drafting"). If this check uses string similarity only (Levenshtein, Jaro-Winkler), it misses semantic near-duplicates with different wording. If it uses embedding similarity, the threshold calibration problem from SOUL-5 reappears: the threshold that catches true near-duplicates may also collapse genuinely different categories that happen to share keywords.

**Why it happens:** Category label near-duplicate detection is treated as a search problem when it is actually a judgment call that requires semantic understanding plus domain context.

**Prevention:**
- Use a two-stage check: first, embedding similarity to catch obvious near-duplicates (similarity >0.90); second, an LLM classifier that receives the two candidate labels and existing library categories and explicitly judges whether they represent meaningfully different task types
- When the LLM classifier flags a potential duplicate, route to human review immediately — this is a rare event (Pioneer events are rare) and the cost of human review is negligible
- Store the full set of existing category labels in a cached index; when a Pioneer event fires, the near-duplicate check runs against this full index in a single batch embedding call

**Warning signs:**
- Category near-duplicate detection using only string distance metrics
- Two categories in the library that human reviewers would consider identical
- Pioneer events for "email outreach" and "cold email drafting" creating separate benchmarks

**Phase mapping:** Address in the Benchmark Instantiation phase. The near-duplicate check must be in place before any Pioneer events can create library entries.

---

### DATA-2: Mutation Lineage Graph Grows Without Pruning, Causing Query Performance Degradation

**Severity:** LOW (initially), HIGH (over time)

**What goes wrong:** Each soul version is linked to its parent souls and mutation operations. After 6 months of operation, a high-frequency task category may have 500+ soul versions in its lineage graph. Queries that traverse the full lineage (to compute drift scores, to display mutation history to users, to select parent souls for the next generation) become table scans or recursive CTEs over large graphs. At 1,000+ versions, these queries degrade significantly.

**Why it happens:** Lineage is append-only by design (retired agents are never deleted). The performance implication only becomes visible after sustained operation.

**Prevention:**
- Design the lineage graph query with index on `(task_category, agent_class, fitness_score)` so parent selection queries do not traverse the full graph
- Implement lineage pruning: after N generations, collapse the lineage to a summary entry ("derived from [ancestor soul ID] through 12 mutation operations — lineage archived") rather than maintaining the full chain
- Store the drift distance from nearest Artisan ancestor as a computed column, updated at write time — do not recompute it at query time by traversing the lineage

**Warning signs:**
- Soul version count exceeding 100 for any single task category without query performance measurement
- Lineage traversal queries without LIMIT clauses
- Drift score computed by joining across the full lineage on every parent-selection query

**Phase mapping:** Address in the DNA Library implementation phase. Index design must be specified before the first library write.

---

## UX and Engagement Pitfalls

---

### UX-1: Gamification Narrative Accelerates Confirmation Rubber-Stamping

**Severity:** HIGH

**What goes wrong:** The promotion/demotion narrative events ("Agent 7 has been promoted to Understudy after three successful campaigns") are designed to build user investment. They also create social pressure to confirm promotions. A user who sees "Agent 7 is ready for promotion" followed by a confirmation prompt will feel that rejecting the promotion is a negative action — they are "holding back" their agent. This creates a soft coercion toward rubber-stamp confirmations that the gamification mechanics amplify over time.

**Why it happens:** Gamification and ground-truth signal collection are in tension. Gamification wants users to feel good about their army's success; ground-truth collection needs users to be willing to reject poor performers, even when the narrative frames them sympathetically.

**Prevention:**
- Decouple the narrative event from the confirmation prompt: show the promotion narrative as an outcome of the run, but present the confirmation as a separate step framed as "teaching the army" not "approving the promotion"
- Frame rejection as a positive contribution: "Marking this run as below expectations helps your army learn faster" — not "reject promotion"
- Show the Devil's Advocate argument prominently for any promotion confirmation where one exists; present it as "your advisor has a concern" rather than burying it in a collapsible section
- Track per-user rejection rate; if it drops to zero over 10+ confirmations, the user is likely rubber-stamping — surface a calibration prompt

**Warning signs:**
- Confirmation modal using language like "Promote Agent 7?" rather than "Did this run meet your expectations?"
- Devil's Advocate arguments in a collapsed or secondary section of the confirmation modal
- Zero rejections from a user who has confirmed 20+ runs

**Phase mapping:** Address in the human confirmation gate UX phase. Copy and framing decisions must be deliberate from launch.

---

### UX-2: Gaming — Users Confirm Poor Runs to Artificially Accelerate Promotions

**Severity:** MEDIUM

**What goes wrong:** Users who want Artisan-class agents faster than the system's promotion thresholds allow can simply confirm every run as high quality, regardless of actual output. The system's confirmation signal becomes corrupted. Artisan agents promoted through gaming carry soul configurations that were selected for speed of promotion, not quality of performance. These agents then seed future populations with their corrupted DNA.

**Why it happens:** The system has no ground-truth verification mechanism independent of user confirmation. Human confirmation is the ground truth. If the human lies, there is no backstop.

**Prevention:**
- Cross-reference user confirmation signals against objective performance indicators that cannot be gamed: tool call success rate, budget adherence, output structure validity, task completion time relative to benchmark — these are auditable without user input
- Flag runs where user confirmation is positive but objective metrics are below median for the task category; do not block the confirmation, but mark the library entry with a `low-confidence` flag and require 2 additional confirmed-positive runs before promotion executes
- Add a minimum time-between-runs constraint for promotion eligibility: a user who runs 3 quick campaigns specifically to hit the promotion threshold should not bypass the spirit of the requirement — the runs must be spread over at least N days for Understudy, M days for Artisan
- For Artisan promotion specifically, require that at least one confirming run was for a different user or account (if multi-tenant is in scope) — cross-account validation is harder to game

**Warning signs:**
- User with 100% confirmation rate and below-median objective metrics on confirmed runs
- Promotions clustering within 48 hours of first run in a category (too fast to be genuine learning)
- Library entries with consistently high council scores but low objective metrics

**Phase mapping:** Address in the Promotion and Demotion algorithm phase, alongside the confirmation gate.

---

## Prevention Strategies by Phase

| Phase | Primary Risk | Prevention | Confidence |
|-------|--------------|------------|------------|
| Council architecture | Synchronous evaluation blocking execution | Async BullMQ council-queue; display results before verdicts arrive | HIGH |
| Causal attribution | Self-reported tags are confabulated | Counterfactual verification required; treat self-report as hypothesis only | HIGH |
| Council implementation | Sycophantic consensus collapse | Independent evaluation (no inter-agent visibility); heterogeneous models | HIGH |
| Human confirmation gate | Rubber-stamp degradation | Time measurement; evidence surface; anti-gamification framing | MEDIUM |
| DNA library migration | Schema breakage on existing queries | Single coordinated Drizzle migration; null-handling audit; soul_version discriminator | HIGH |
| Soul differentiation | Embedding threshold miscalibration | Calibration run before production; periodic behavioral validation against actual behavioral variance | MEDIUM |
| Fitness scoring | Thin benchmark producing misleading verdicts | Mandatory confidence discount; no promotions until benchmark matures at 3 runs | HIGH |
| God Layer | Mutations during active campaigns | Run soul_snapshot at execution start; lock category library during active campaigns | HIGH |
| Mutation drift | Successive mutations diverging from validated ancestors | Drift score as embedding distance from nearest Artisan; enforce drift ceiling at deploy time, not just at generation | MEDIUM |
| Category labeling | Near-duplicate Pioneer categories | Two-stage check (embedding + LLM classifier); rare enough to route all ambiguous cases to human review | MEDIUM |
| Queue topology | Council jobs competing with execution jobs | Separate named queues with separate worker pools from the start | HIGH |
| Council cost | Unbounded LLM spend on large traces | Token ceiling on Council context; trace summarization; cost routing through metering | HIGH |
| Gamification | Narrative accelerating rubber-stamping | Decouple narrative from confirmation; rejection framed as positive contribution | MEDIUM |
| Gaming detection | Artificial promotion through confirmed poor runs | Cross-reference against objective metrics; minimum time-between-runs for promotion | MEDIUM |

---

## Sources

### Base Platform Sources
- [Container Escape Vulnerabilities: AI Agent Security for 2026 — Blaxel](https://blaxel.ai/blog/container-escape)
- [How to Sandbox AI Agents in 2026: MicroVMs, gVisor & Isolation Strategies — Northflank](https://northflank.com/blog/how-to-sandbox-ai-agents)
- [Docker Security Best Practices 2026 — TheLinuxCode](https://thelinuxcode.com/docker-security-best-practices-2026-hardening-the-host-images-and-runtime-without-slowing-teams-down/)
- [Docker Engine v28: Hardening Container Networking by Default](https://www.docker.com/blog/docker-engine-28-hardening-container-networking-by-default/)
- [BullMQ Stalled Jobs Documentation](https://docs.bullmq.io/guide/workers/stalled-jobs)
- [BullMQ GitHub Issue #652 — Queue Stuck with Jobs in "Active" State](https://github.com/taskforcesh/bullmq/issues/652)
- [Token Counting Explained: tiktoken, Anthropic, and Gemini (2025) — Propel](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025)
- [Token Counting — Claude API Documentation](https://platform.claude.com/docs/en/build-with-claude/token-counting)
- [Cost Guardrails for Agent Fleets — Medium](https://medium.com/@Micheal-Lanham/cost-guardrails-for-agent-fleets-how-to-prevent-your-ai-agents-from-burning-through-your-budget-ea68722af3fe)
- [Gartner Predicts Over 40% of Agentic AI Projects Canceled by 2027](https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027)
- [How to Get Consistent and Reproducible LLM Outputs in 2025 — KeywordsAI](https://www.keywordsai.co/blog/llm_consistency_2025)
- [Why Deterministic Output From LLMs Is Nearly Impossible — Unstract](https://unstract.com/blog/understanding-why-deterministic-output-from-llms-is-nearly-impossible/)
- [Google Cloud Run Quotas and Limits](https://docs.cloud.google.com/run/quotas)
- [Google Container Registry Deprecation 2025 — Chkk](https://www.chkk.io/blog/google-container-registry-deprecation)
- [Troubleshoot Network Isolation in GKE — Google Cloud](https://cloud.google.com/kubernetes-engine/docs/troubleshooting/network-isolation)
- [WebSocket Scale in 2025: Architecting Real-Time Systems — VideoSDK](https://www.videosdk.live/developer-hub/websocket/websocket-scale)
- [How to Scale WebSockets for High-Concurrency Systems — Ably](https://ably.com/topic/the-challenge-of-scaling-websockets)
- [AI Evaluation Metrics 2025 — Master of Code](https://masterofcode.com/blog/ai-agent-evaluation)
- [AI Agent Performance Measurement — Microsoft Dynamics 365 Blog](https://www.microsoft.com/en-us/dynamics-365/blog/it-professional/2026/02/04/ai-agent-performance-measurement/)
- [Why AI Agents Fail in Production — Medium](https://medium.com/@michael.hannecke/why-ai-agents-fail-in-production-what-ive-learned-the-hard-way-05f5df98cbe5)
- [Docker Packet Filtering and Firewalls Documentation](https://docs.docker.com/engine/network/packet-filtering-firewalls/)
- [LLM Guardrails Best Practices — Datadog](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)

### SOUL System Sources
- [LLM-as-a-Judge: Complete Guide — Evidently AI](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- [Using LLM-as-a-Judge For Evaluation: A Complete Guide — Hamel Husain](https://hamel.dev/blog/posts/llm-judge/)
- [LLMs as Judges: Practical Problems and How to Avoid Them — Katherine Munro](https://katherine-munro.com/p/practical-problems-with-llms-as-judges)
- [LLM Judges Are Unreliable — Collective Intelligence Project](https://www.cip.org/blog/llm-judges-are-unreliable)
- [Justice or Prejudice? Quantifying Biases in LLM-as-a-Judge](https://arxiv.org/html/2410.02736v1)
- [Self-Preference Bias in LLM-as-a-Judge](https://arxiv.org/html/2410.21819v2)
- [A Systematic Study of Position Bias in LLM-as-a-Judge](https://aclanthology.org/2025.ijcnlp-long.18.pdf)
- [CONSENSAGENT: Sycophancy Mitigation in Multi-Agent LLM Interactions](https://aclanthology.org/2025.findings-acl.1141/)
- [Peacemaker or Troublemaker: How Sycophancy Shapes Multi-Agent Debate](https://arxiv.org/html/2509.23055v1)
- [Voting or Consensus? Decision-Making in Multi-Agent LLM Systems](https://aclanthology.org/2025.findings-acl.606.pdf)
- [Enhancing LLM-as-a-Judge via Multi-Agent Collaboration — Amazon Science](https://assets.amazon.science/48/5d/20927f094559a4465916e28f41b5/enhancing-llm-as-a-judge-via-multi-agent-collaboration.pdf)
- [Gaming the System: Goodhart's Law Exemplified in AI Leaderboard Controversy — Collinear AI](https://blog.collinear.ai/p/gaming-the-system-goodharts-law-exemplified-in-ai-leaderboard-controversy)
- [Reward Hacking — Lil'Log (Lilian Weng)](https://lilianweng.github.io/posts/2024-11-28-reward-hacking/)
- [Recent Frontier Models Are Reward Hacking — METR](https://metr.org/blog/2025-06-05-recent-reward-hacking/)
- [Causal Interpretability: Problems, Methods and Evaluation — KDD](https://www.kdd.org/exploration_files/4._CR._25._Causal_Explainability_Survey-final.pdf)
- [From Features to Actions: Explainability in Traditional and Agentic AI Systems](https://arxiv.org/pdf/2602.06841)
- [Premature Convergence in Genetic Algorithms — Wikipedia](https://en.wikipedia.org/wiki/Premature_convergence)
- [Degree of Population Diversity and Premature Convergence — IEEE](https://ieeexplore.ieee.org/document/623217/)
- [Do We Need Domain-Specific Embedding Models? An Empirical Investigation](https://arxiv.org/html/2409.18511v2)
- [Versioning, Rollback & Lifecycle Management of AI Agents — Medium](https://medium.com/@nraman.n6/versioning-rollback-lifecycle-management-of-ai-agents-treating-intelligence-as-deployable-deac757e4dea)
- [Reducing Latency and Cost at Scale: LLM Performance Optimization — Tribe AI](https://www.tribe.ai/applied-ai/reducing-latency-and-cost-at-scale-llm-performance)
- [Human-in-the-Loop Isn't Enough: New Attack Turns AI Safeguards Into Exploits — CSO Online](https://www.csoonline.com/article/4108592/human-in-the-loop-isnt-enough-new-attack-turns-ai-safeguards-into-exploits.html)
- [An Approach for Systematic Decomposition of Complex LLM Tasks](https://arxiv.org/html/2510.07772v1)
