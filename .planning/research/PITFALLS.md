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

## Phase-Specific Warnings

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

## Sources

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
