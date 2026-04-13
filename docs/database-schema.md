# Database Schema Documentation

Akasa uses **PostgreSQL** with the **pgvector** extension for embedding similarity search. The ORM layer is **Drizzle ORM** with the `node-postgres` driver. Schema source files live in `packages/db/src/schema/`.

## Conventions

- **Primary keys**: UUID v4 (`uuid().primaryKey().defaultRandom()`) on most tables; `text` primary keys on auth tables (BetterAuth convention) and `api_keys`.
- **Timestamps**: All `timestamptz` with millisecond precision (`precision: 3`), except auth tables which use default precision.
- **Enums**: PostgreSQL `pgEnum` for closed value sets (bot status, verdict type, agent class, etc.).
- **Logical foreign keys**: Several columns intentionally omit `references()` to avoid circular TypeScript inference at module load time. These are documented inline and shown as dashed lines in the ERD below.
- **pgvector**: The `bot_souls.embedding` column uses `vector(1536)` for cosine similarity search with OpenAI `text-embedding-3-small` embeddings.
- **JSONB columns**: Used for flexible structured data (soul dimensions, DNA payloads, mission briefs, tool schemas).
- **Soft deletes**: Not used. Rows are either archived (`is_archived` flag on `objectives`) or hard-deleted via cascade.

## Entity Relationship Diagram

```mermaid
erDiagram
    %% ── Auth Domain ──────────────────────────────────────────────

    user {
        text id PK
        text name
        text email
        boolean email_verified
        text image
        timestamptz created_at
        timestamptz updated_at
    }

    session {
        text id PK
        timestamptz expires_at
        text token
        text ip_address
        text user_agent
        text user_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    account {
        text id PK
        text account_id
        text provider_id
        text user_id FK
        text access_token
        text refresh_token
        text id_token
        timestamptz access_token_expires_at
        timestamptz refresh_token_expires_at
        text scope
        text password
        timestamptz created_at
        timestamptz updated_at
    }

    verification {
        text id PK
        text identifier
        text value
        timestamptz expires_at
        timestamptz created_at
        timestamptz updated_at
    }

    user_preferences {
        text user_id PK-FK
        boolean email_evolution_events
        boolean email_budget_alerts
        boolean email_skill_events
        boolean in_app_evolution_events
        boolean in_app_budget_alerts
        boolean in_app_skill_events
        boolean budget_alert_threshold_50
        boolean budget_alert_threshold_75
        boolean budget_alert_threshold_90
        timestamptz created_at
        timestamptz updated_at
    }

    api_keys {
        text id PK
        text user_id FK
        text key_hash
        varchar key_prefix
        varchar name
        timestamptz created_at
        timestamptz last_used_at
        timestamptz revoked_at
    }

    user ||--o{ session : "has"
    user ||--o{ account : "has"
    user ||--o| user_preferences : "has"
    user ||--o{ api_keys : "has"

    %% ── Execution Domain ─────────────────────────────────────────

    objectives {
        uuid id PK
        varchar name
        text description
        integer default_max_bots
        integer default_budget_cap_cents
        integer default_runtime_limit_seconds
        text[] default_allowed_tools
        boolean is_archived
        uuid project_id "logical FK to Paperclip"
        timestamptz created_at
        timestamptz updated_at
    }

    executions {
        uuid id PK
        execution_status status
        text objective
        integer max_bots
        integer budget_cap_cents
        integer runtime_limit_seconds
        text[] allowed_tools
        varchar llm_provider
        text[] allowed_domains
        varchar task_category
        varchar campaign_type
        uuid objective_id FK
        uuid ring_leader_run_id "logical FK"
        uuid project_id "logical FK to Paperclip"
        uuid evolution_campaign_id "logical FK"
        timestamptz created_at
        timestamptz updated_at
    }

    bots {
        uuid id PK
        uuid execution_id FK
        bot_status status
        varchar container_id
        varchar image_tag
        timestamptz started_at
        timestamptz stopped_at
        timestamptz last_heartbeat_at
        integer tasks_claimed
        integer tasks_completed
        integer tasks_failed
        numeric composite_score
        varchar tier
        text error_message
        uuid soul_id "logical FK to bot_souls"
        uuid paperclip_agent_id "logical FK to Paperclip"
        timestamptz created_at
        timestamptz updated_at
    }

    tasks {
        uuid id PK
        uuid execution_id FK
        task_status status
        text description
        text result
        uuid claimed_by_bot_id "logical FK to bots"
        varchar ring_leader_task_id
        timestamptz lease_expires_at
        integer attempt_count
        timestamptz created_at
        timestamptz updated_at
    }

    ring_leader_runs {
        uuid id PK
        uuid execution_id FK
        uuid soul_id "logical FK to bot_souls"
        ring_leader_status status
        jsonb mission_brief
        jsonb population_manifest
        jsonb run_state
        jsonb synthesis
        timestamptz started_at
        timestamptz completed_at
        timestamptz created_at
        timestamptz updated_at
    }

    ring_leader_fitness {
        uuid id PK
        uuid ring_leader_run_id FK
        jsonb coordination_score
        jsonb soul_selection_score
        numeric composite_score
        jsonb soul_selection_log
        jsonb library_search_queries
        text selection_retrospective
        integer pioneer_tasks_handled
        integer mutation_operations_applied
        numeric mutation_success_rate
        timestamptz created_at
    }

    objectives ||--o{ executions : "template for"
    executions ||--o{ bots : "spawns"
    executions ||--o{ tasks : "decomposes into"
    executions ||--o| ring_leader_runs : "orchestrated by"
    ring_leader_runs ||--o| ring_leader_fitness : "scored by"
    bots }o--o{ tasks : "claims"

    %% ── Evolution Domain ─────────────────────────────────────────

    bot_souls {
        uuid id PK
        boolean is_archetype
        varchar archetype_name
        uuid bot_id "logical FK to bots"
        uuid execution_id "logical FK to executions"
        varchar task_category
        text soul_content
        varchar content_hash
        integer generation
        uuid parent_soul_id FK-self
        jsonb dimensions
        jsonb constitution_directives
        vector embedding "pgvector 1536-dim"
        boolean human_review_flag
        timestamptz created_at
    }

    council_verdicts {
        uuid id PK
        uuid execution_id FK
        uuid bot_id "logical FK to bots"
        uuid soul_id "logical FK to bot_souls"
        verdict_type verdict_type
        verdict_status status
        numeric weighted_confidence_score
        boolean requires_human_confirmation
        boolean has_unresolved_devils_advocate
        text verdict_summary
        jsonb performance_judge_output
        jsonb soul_analyst_output
        jsonb devils_advocate_output
        timestamptz confirmed_at
        varchar confirmed_by
        integer time_on_screen_ms
        timestamptz god_layer_processed_at
        timestamptz created_at
        timestamptz updated_at
    }

    agent_classes {
        uuid id PK
        uuid bot_id "logical FK to bots"
        varchar task_category
        agent_class current_class
        integer above_benchmark_count
        integer below_benchmark_count
        integer human_confirmation_count
        integer consecutive_below_count
        boolean is_pioneer
        uuid last_verdict_id "logical FK to council_verdicts"
        timestamptz last_transition_at
        timestamptz artisan_graduation_at
        timestamptz created_at
        timestamptz updated_at
    }

    dna_store {
        uuid id PK
        uuid bot_id "logical FK to bots"
        uuid execution_id FK
        varchar objective_category
        integer version
        numeric composite_score
        jsonb dna_payload
        timestamptz captured_at
        boolean is_provisional
        uuid soul_id "logical FK to bot_souls"
        uuid[] parent_soul_ids
        jsonb mutation_lineage
        boolean is_published
        timestamptz published_at
        text publish_title
        text publish_description
        integer acquired_count
    }

    negative_signal_register {
        uuid id PK
        uuid soul_id FK
        uuid bot_id "logical FK to bots"
        uuid execution_id FK
        varchar failure_type
        text directive_failure_summary
        jsonb mutation_blacklist
        timestamptz registered_at
    }

    category_benchmarks {
        uuid id PK
        varchar task_category UK
        uuid pioneer_bot_id "logical FK to bots"
        uuid pioneer_soul_id "logical FK to bot_souls"
        uuid pioneer_execution_id "logical FK to executions"
        numeric baseline_composite_score
        integer confirmed_run_count
        boolean thin_data_flag
        boolean benchmark_mature
        boolean standard_promotion
        timestamptz created_at
        timestamptz updated_at
    }

    decision_traces {
        uuid id PK
        uuid execution_id FK
        uuid bot_id "logical FK to bots"
        uuid soul_id FK
        uuid decision_id UK
        varchar decision_type
        text directive_referenced
        numeric attribution_confidence
        varchar outcome
        jsonb metadata
        timestamptz decided_at
        timestamptz created_at
    }

    evolution_campaigns {
        uuid id PK
        text objective
        uuid project_id "logical FK to Paperclip"
        integer max_iterations
        integer campaign_budget_cap_cents
        integer seed_max_bots
        integer seed_budget_cap_cents
        integer seed_runtime_limit_seconds
        text[] seed_allowed_tools
        varchar seed_llm_provider
        text[] seed_allowed_domains
        evolution_campaign_status status
        integer completed_iteration_count
        numeric best_efs_score
        timestamptz created_at
        timestamptz updated_at
        timestamptz stopped_at
    }

    evolution_campaign_iterations {
        uuid id PK
        uuid campaign_id FK
        integer iteration_num
        uuid execution_id "logical FK to executions"
        numeric efs_score
        numeric success_rate
        numeric cost_efficiency
        numeric speed
        numeric council_health
        numeric delta_from_previous
        varchar halted_reason
        timestamptz created_at
        timestamptz completed_at
    }

    learned_skills {
        uuid id PK
        uuid bot_id FK
        uuid soul_id "logical FK to bot_souls"
        uuid execution_id FK
        varchar name
        varchar category
        jsonb trigger_patterns
        text procedural_body
        jsonb required_tools
        numeric confidence_score
        skill_approval_status approval_status
        jsonb source_trace_ids
        text skill_content
        timestamptz created_at
        timestamptz approved_at
        text approved_by
    }

    bot_souls ||--o| bot_souls : "parent lineage"
    executions ||--o{ council_verdicts : "evaluated by"
    executions ||--o{ dna_store : "captures DNA from"
    executions ||--o{ decision_traces : "traces decisions in"
    bot_souls ||--o{ negative_signal_register : "flagged in"
    executions ||--o{ negative_signal_register : "signals from"
    evolution_campaigns ||--o{ evolution_campaign_iterations : "iterates through"
    bots ||--o{ learned_skills : "discovers"
    executions ||--o{ learned_skills : "produces"

    %% ── Skill Domain ─────────────────────────────────────────────

    skills {
        uuid id PK
        text user_id "logical FK to user"
        varchar name
        text description
        varchar version
        skill_category category
        jsonb triggers
        jsonb requires_tools
        jsonb requires_skills
        varchar min_agent_class
        text content
        varchar content_hash
        skill_source source
        varchar is_public
        jsonb effectiveness_stats
        timestamptz created_at
        timestamptz updated_at
    }

    agent_skills_v2 {
        uuid id PK
        uuid company_id
        varchar skill_name
        text skill_description
        text skill_content
        jsonb metadata
        integer version
        boolean is_published
        timestamptz published_at
        source_type source_type
        timestamptz created_at
        timestamptz updated_at
    }

    skill_loadouts {
        uuid id PK
        uuid bot_id FK
        uuid skill_id FK
        boolean is_active
        timestamptz equipped_at
        timestamptz removed_at
    }

    skill_activations {
        uuid id PK
        uuid bot_id FK
        uuid skill_id FK
        uuid execution_id "logical FK to executions"
        timestamptz activated_at
        float composite_score_delta
        activation_classification classification
        integer consecutive_negative_count
    }

    bots ||--o{ skill_loadouts : "equips"
    agent_skills_v2 ||--o{ skill_loadouts : "loaded into"
    bots ||--o{ skill_activations : "activates"
    agent_skills_v2 ||--o{ skill_activations : "tracked by"

    %% ── Telemetry & Billing Domain ───────────────────────────────

    telemetry {
        uuid id PK
        uuid execution_id FK
        uuid bot_id FK
        varchar metric_name
        numeric metric_value
        timestamptz computed_at
    }

    billing_events {
        uuid id PK
        uuid execution_id FK
        uuid bot_id "logical FK to bots"
        uuid project_id "logical FK to Paperclip"
        billing_event_type event_type
        integer amount_cents
        integer token_count
        jsonb metadata
        timestamptz occurred_at
    }

    executions ||--o{ telemetry : "measures"
    bots ||--o{ telemetry : "produces"
    executions ||--o{ billing_events : "billed via"

    %% ── Tool Domain ──────────────────────────────────────────────

    tool_invocations {
        uuid id PK
        uuid execution_id FK
        uuid bot_id FK
        varchar tool_name
        uuid invocation_id
        boolean rejected
        varchar rejection_reason
        integer duration_ms
        integer prompt_tokens
        integer completion_tokens
        integer total_tokens
        jsonb request_summary
        jsonb response_summary
        timestamptz invoked_at
    }

    tool_connections {
        uuid id PK
        text user_id "logical FK to user"
        text tool_id
        text connection_type
        text status
        text display_label
        text encrypted_access_token
        text encrypted_refresh_token
        text token_iv
        text token_tag
        text refresh_iv
        text refresh_tag
        text encrypted_api_key
        text api_key_iv
        text api_key_tag
        integer key_version
        timestamptz token_expires_at
        text scopes
        timestamptz rate_limit_reset_at
        timestamptz last_used_at
        timestamptz created_at
        timestamptz updated_at
    }

    tool_invocation_logs {
        uuid id PK
        text tool_id
        text action
        text agent_id
        text user_id "logical FK to user"
        uuid connection_id "logical FK to tool_connections"
        integer latency_ms
        boolean success
        text error_message
        text request_summary
        text response_summary
        timestamptz created_at
    }

    tool_registry {
        uuid id PK
        text user_id "logical FK to user"
        uuid spec_id
        text spec_title
        text spec_version
        text spec_url
        text base_url
        text operation_id
        text method
        text path
        text summary
        text description
        jsonb parameters
        jsonb request_body
        jsonb response_schema
        jsonb tags
        boolean is_enabled
        timestamptz created_at
        timestamptz updated_at
    }

    webhook_routing_rules {
        uuid id PK
        text user_id "logical FK to user"
        uuid connection_id "logical FK to tool_connections"
        text tool_id
        text event_type
        text condition
        text assign_to_agent_id "logical FK to Paperclip"
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    executions ||--o{ tool_invocations : "invokes tools in"
    bots ||--o{ tool_invocations : "makes"
    tool_connections ||--o{ tool_invocation_logs : "logged by"
    tool_connections ||--o{ webhook_routing_rules : "routes via"

    %% ── Marketplace Domain ───────────────────────────────────────

    marketplace_reviews {
        uuid id PK
        text user_id "logical FK to user"
        uuid target_id "polymorphic FK to dna_store or skills"
        text target_type
        integer rating
        text review_text
        timestamptz created_at
        timestamptz updated_at
    }
```

## Table Reference

### Auth Domain

Tables shared with Paperclip's BetterAuth session store. Table names must match BetterAuth defaults exactly (`user`, `session`, `account`, `verification`).

#### `user`
Core user identity. Primary key is `text` (BetterAuth convention, not UUID).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PK | BetterAuth user ID |
| `name` | text | NOT NULL | Display name |
| `email` | text | NOT NULL | Email address |
| `email_verified` | boolean | NOT NULL, default `false` | Email verification status |
| `image` | text | nullable | Profile image URL |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

#### `session`
Active user sessions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PK | Session ID |
| `expires_at` | timestamptz | NOT NULL | Session expiry |
| `token` | text | NOT NULL | Session token |
| `ip_address` | text | nullable | Client IP |
| `user_agent` | text | nullable | Client user agent |
| `user_id` | text | NOT NULL, FK -> `user.id` CASCADE | Owning user |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

#### `account`
OAuth provider accounts linked to users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PK | Account ID |
| `account_id` | text | NOT NULL | Provider-side account ID |
| `provider_id` | text | NOT NULL | OAuth provider identifier |
| `user_id` | text | NOT NULL, FK -> `user.id` CASCADE | Owning user |
| `access_token` | text | nullable | OAuth access token |
| `refresh_token` | text | nullable | OAuth refresh token |
| `id_token` | text | nullable | OIDC ID token |
| `access_token_expires_at` | timestamptz | nullable | Access token expiry |
| `refresh_token_expires_at` | timestamptz | nullable | Refresh token expiry |
| `scope` | text | nullable | Granted OAuth scopes |
| `password` | text | nullable | Password hash (unused) |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

#### `verification`
Email/phone verification tokens.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PK | Verification ID |
| `identifier` | text | NOT NULL | What is being verified (email, phone) |
| `value` | text | NOT NULL | Verification token value |
| `expires_at` | timestamptz | NOT NULL | Token expiry |
| `created_at` | timestamptz | nullable | Creation timestamp |
| `updated_at` | timestamptz | nullable | Last update timestamp |

#### `user_preferences`
Per-user notification and alert preferences.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `user_id` | text | PK, FK -> `user.id` CASCADE | Owning user |
| `email_evolution_events` | boolean | NOT NULL, default `true` | Email on evolution events |
| `email_budget_alerts` | boolean | NOT NULL, default `true` | Email on budget alerts |
| `email_skill_events` | boolean | NOT NULL, default `true` | Email on skill events |
| `in_app_evolution_events` | boolean | NOT NULL, default `true` | In-app evolution notifications |
| `in_app_budget_alerts` | boolean | NOT NULL, default `true` | In-app budget notifications |
| `in_app_skill_events` | boolean | NOT NULL, default `true` | In-app skill notifications |
| `budget_alert_threshold_50` | boolean | NOT NULL, default `true` | Alert at 50% budget |
| `budget_alert_threshold_75` | boolean | NOT NULL, default `true` | Alert at 75% budget |
| `budget_alert_threshold_90` | boolean | NOT NULL, default `true` | Alert at 90% budget |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

#### `api_keys`
User API keys for programmatic access.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | text | PK | Key ID |
| `user_id` | text | NOT NULL, FK -> `user.id` CASCADE | Owning user |
| `key_hash` | text | NOT NULL | SHA-256 hash of the API key |
| `key_prefix` | varchar(8) | NOT NULL | First 8 chars for display (e.g., `ak_xxxx`) |
| `name` | varchar(255) | NOT NULL | Human-readable key name |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `last_used_at` | timestamptz | nullable | Last usage timestamp |
| `revoked_at` | timestamptz | nullable | Revocation timestamp (soft-revoke) |

---

### Execution Domain

Core tables for objective management, execution lifecycle, bot orchestration, and task dispatch.

#### `objectives`
Reusable execution templates with preset defaults.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Objective ID |
| `name` | varchar(255) | NOT NULL | Objective name |
| `description` | text | nullable | Detailed description |
| `default_max_bots` | integer | NOT NULL, default `5` | Default bot count |
| `default_budget_cap_cents` | integer | nullable | Default budget cap in cents |
| `default_runtime_limit_seconds` | integer | nullable | Default runtime limit |
| `default_allowed_tools` | text[] | NOT NULL, default `{}` | Default tool allowlist |
| `is_archived` | boolean | NOT NULL, default `false` | Archive flag (hidden from new executions) |
| `project_id` | uuid | nullable | Logical FK to Paperclip projects |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

#### `executions`
A single run of an objective -- spawns bots, dispatches tasks, collects results.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Execution ID |
| `status` | execution_status | NOT NULL, default `pre_flight` | Lifecycle state: `pre_flight`, `queued`, `running`, `paused`, `stopped`, `completed`, `failed` |
| `objective` | text | NOT NULL | The objective text for this run |
| `max_bots` | integer | NOT NULL | Maximum bots to spawn |
| `budget_cap_cents` | integer | NOT NULL | Budget cap in cents |
| `runtime_limit_seconds` | integer | NOT NULL | Maximum runtime in seconds |
| `allowed_tools` | text[] | NOT NULL | Tools bots may invoke |
| `llm_provider` | varchar(50) | nullable | LLM provider override |
| `allowed_domains` | text[] | nullable | Domain allowlist for bot egress |
| `task_category` | varchar(255) | nullable | Derived category for soul seeding |
| `campaign_type` | varchar(20) | nullable | `ad_hoc` or `campaign` |
| `objective_id` | uuid | FK -> `objectives.id` SET NULL | Source objective template |
| `ring_leader_run_id` | uuid | nullable | Logical FK to `ring_leader_runs.id` |
| `project_id` | uuid | nullable | Logical FK to Paperclip projects |
| `evolution_campaign_id` | uuid | nullable | Logical FK to `evolution_campaigns.id` |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

#### `bots`
AI agents running on GCE VMs with OpenClaw.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Bot ID |
| `execution_id` | uuid | NOT NULL, FK -> `executions.id` CASCADE | Parent execution |
| `status` | bot_status | NOT NULL, default `spawning` | Lifecycle: `spawning`, `idle`, `working`, `stopping`, `stopped`, `failed` |
| `container_id` | varchar(255) | nullable | GCE VM instance ID |
| `image_tag` | varchar(255) | NOT NULL | OpenClaw version tag |
| `started_at` | timestamptz | nullable | VM start time |
| `stopped_at` | timestamptz | nullable | VM stop time |
| `last_heartbeat_at` | timestamptz | nullable | Last health check |
| `tasks_claimed` | integer | NOT NULL, default `0` | Tasks claimed counter |
| `tasks_completed` | integer | NOT NULL, default `0` | Tasks completed counter |
| `tasks_failed` | integer | NOT NULL, default `0` | Tasks failed counter |
| `composite_score` | numeric(5,2) | nullable | Fitness score from Council evaluation |
| `tier` | varchar(10) | nullable | LLM tier assignment |
| `error_message` | text | nullable | Last error message |
| `soul_id` | uuid | nullable | Logical FK to `bot_souls.id` |
| `paperclip_agent_id` | uuid | nullable | Logical FK to Paperclip `agents.id` |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

#### `tasks`
Individual work units decomposed from an execution's objective.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Task ID |
| `execution_id` | uuid | NOT NULL, FK -> `executions.id` CASCADE | Parent execution |
| `status` | task_status | NOT NULL, default `pending` | Lifecycle: `pending`, `claimed`, `completed`, `failed` |
| `description` | text | NOT NULL | Task description |
| `result` | text | nullable | Task output/result |
| `claimed_by_bot_id` | uuid | nullable | Logical FK to `bots.id` |
| `ring_leader_task_id` | varchar(255) | nullable | Ring Leader's internal task ID |
| `lease_expires_at` | timestamptz | nullable | Task lease expiry for claim timeout |
| `attempt_count` | integer | NOT NULL, default `0` | Number of execution attempts |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

#### `ring_leader_runs`
Orchestrator agent runs that plan task graphs, select souls, and coordinate execution.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Run ID |
| `execution_id` | uuid | NOT NULL, FK -> `executions.id` CASCADE | Parent execution |
| `soul_id` | uuid | nullable | Logical FK to `bot_souls.id` (Ring Leader's own soul) |
| `status` | ring_leader_status | NOT NULL, default `assembling` | Lifecycle: `assembling`, `spawning`, `coordinating`, `synthesizing`, `completed`, `failed` |
| `mission_brief` | jsonb | NOT NULL | Objective, task graph, tool grants, budget, runtime config |
| `population_manifest` | jsonb | nullable | Soul population per task (filled after assembly) |
| `run_state` | jsonb | nullable | Live coordination state (elapsed time, budget, drift, anomalies) |
| `synthesis` | jsonb | nullable | Post-run synthesis document |
| `started_at` | timestamptz | nullable | Run start time |
| `completed_at` | timestamptz | nullable | Run completion time |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

#### `ring_leader_fitness`
Fitness scores for Ring Leader orchestration quality.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Record ID |
| `ring_leader_run_id` | uuid | NOT NULL, FK -> `ring_leader_runs.id` CASCADE, UNIQUE | Parent run |
| `coordination_score` | jsonb | NOT NULL | 4-dimension breakdown (collective outcome, drift prevention, reallocation, budget) |
| `soul_selection_score` | jsonb | NOT NULL | 5-dimension breakdown (library search, differentiation, mutation, pioneer, retrospective) |
| `composite_score` | numeric(5,2) | NOT NULL | Weighted composite: coordination 60% + soul selection 40% |
| `soul_selection_log` | jsonb | nullable | Full population manifest snapshot |
| `library_search_queries` | jsonb | nullable | Search queries per task |
| `selection_retrospective` | text | nullable | Ring Leader's self-assessment |
| `pioneer_tasks_handled` | integer | NOT NULL, default `0` | Pioneer task count |
| `mutation_operations_applied` | integer | NOT NULL, default `0` | Mutation operation count |
| `mutation_success_rate` | numeric(4,3) | nullable | Fraction 0.000 to 1.000 |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |

---

### Evolution Domain

Tables powering the soul system, Council evaluation, God Layer processing, DNA capture, and the Karpathy Loop.

#### `bot_souls`
Personality documents (SOUL.md) defining bot behavior. Includes seed archetypes and mutated variants.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Soul ID |
| `is_archetype` | boolean | NOT NULL, default `false` | True for the 6 canonical seed souls |
| `archetype_name` | varchar(100) | nullable | Name of archetype (e.g., "Cautious Verifier") |
| `bot_id` | uuid | nullable | Logical FK to `bots.id` (null for archetypes) |
| `execution_id` | uuid | nullable | Logical FK to `executions.id` (null for archetypes) |
| `task_category` | varchar(255) | nullable | Task category for soul seeding |
| `soul_content` | text | NOT NULL | Full SOUL.md content |
| `content_hash` | varchar(64) | NOT NULL | SHA-256 hex digest for deduplication |
| `generation` | integer | NOT NULL, default `1` | Mutation generation number |
| `parent_soul_id` | uuid | FK -> `bot_souls.id` (self-ref) | Parent soul in lineage tree |
| `dimensions` | jsonb | NOT NULL | 7 behavioral axes (identityRole, decisionPriorities, toolUsageDoctrine, riskTolerance, communicationStyle, recoveryBehavior, ethicalHardStops) |
| `constitution_directives` | jsonb | NOT NULL | Array of inviolable behavioral directives |
| `embedding` | vector(1536) | nullable | pgvector embedding for cosine similarity search |
| `human_review_flag` | boolean | NOT NULL, default `false` | Flagged for human review |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |

#### `council_verdicts`
Output from the 3-judge Council evaluation (Performance Judge, Soul Analyst, Devil's Advocate).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Verdict ID |
| `execution_id` | uuid | NOT NULL, FK -> `executions.id` CASCADE | Parent execution |
| `bot_id` | uuid | NOT NULL | Logical FK to `bots.id` |
| `soul_id` | uuid | nullable | Logical FK to `bot_souls.id` |
| `verdict_type` | verdict_type | NOT NULL | `Promote`, `Maintain`, `Monitor`, `Demote`, `Retire` |
| `status` | verdict_status | NOT NULL, default `pending` | `pending`, `confirmed`, `rejected` |
| `weighted_confidence_score` | numeric(4,3) | NOT NULL | Aggregate confidence 0.000-1.000 |
| `requires_human_confirmation` | boolean | NOT NULL, default `false` | Whether human must confirm |
| `has_unresolved_devils_advocate` | boolean | NOT NULL, default `false` | Devil's Advocate raised objection |
| `verdict_summary` | text | NOT NULL | Human-readable verdict summary |
| `performance_judge_output` | jsonb | nullable | Full Performance Judge output |
| `soul_analyst_output` | jsonb | nullable | Full Soul Analyst output |
| `devils_advocate_output` | jsonb | nullable | Full Devil's Advocate output |
| `confirmed_at` | timestamptz | nullable | When verdict was confirmed |
| `confirmed_by` | varchar(255) | nullable | Who confirmed the verdict |
| `time_on_screen_ms` | integer | nullable | Time user spent reviewing before confirming/rejecting |
| `god_layer_processed_at` | timestamptz | nullable | Idempotency guard for God Layer processing |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

#### `agent_classes`
Bot progression tracking: Novice -> Understudy -> Artisan -> Retired.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Record ID |
| `bot_id` | uuid | NOT NULL | Logical FK to `bots.id` |
| `task_category` | varchar(255) | NOT NULL | Category-specific class |
| `current_class` | agent_class | NOT NULL, default `Novice` | `Novice`, `Understudy`, `Artisan`, `Retired` |
| `above_benchmark_count` | integer | NOT NULL, default `0` | Runs above benchmark |
| `below_benchmark_count` | integer | NOT NULL, default `0` | Runs below benchmark |
| `human_confirmation_count` | integer | NOT NULL, default `0` | Human confirmations received |
| `consecutive_below_count` | integer | NOT NULL, default `0` | Consecutive below-benchmark count |
| `is_pioneer` | boolean | NOT NULL, default `false` | First to achieve category benchmark |
| `last_verdict_id` | uuid | nullable | Logical FK to `council_verdicts.id` |
| `last_transition_at` | timestamptz | nullable | Last class transition time |
| `artisan_graduation_at` | timestamptz | nullable | When promoted to Artisan |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Unique constraint**: `(bot_id, task_category)` -- one class record per bot per category.

#### `dna_store`
Captured behavioral patterns from high-performing bots. The compounding moat.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | DNA record ID |
| `bot_id` | uuid | NOT NULL | Logical FK to `bots.id` |
| `execution_id` | uuid | NOT NULL, FK -> `executions.id` CASCADE | Source execution |
| `objective_category` | varchar(255) | NOT NULL | Task category for lookup |
| `version` | integer | NOT NULL, default `1` | DNA version number |
| `composite_score` | numeric(5,2) | NOT NULL | Bot's fitness score at capture time |
| `dna_payload` | jsonb | NOT NULL | Full behavioral pattern (system prompt template, tool sequences, argument patterns, retry strategy, timing, token distribution, plus God Layer enrichments) |
| `captured_at` | timestamptz | NOT NULL | Capture timestamp |
| `is_provisional` | boolean | NOT NULL, default `false` | Provisional flag (GODL-04) |
| `soul_id` | uuid | nullable | Logical FK to `bot_souls.id` |
| `parent_soul_ids` | uuid[] | nullable | Mutation lineage parent IDs |
| `mutation_lineage` | jsonb | nullable | Operations applied from parent |
| `is_published` | boolean | NOT NULL, default `false` | Published to Akashic Library |
| `published_at` | timestamptz | nullable | Publication timestamp |
| `publish_title` | text | nullable | Marketplace listing title |
| `publish_description` | text | nullable | Marketplace listing description |
| `acquired_count` | integer | NOT NULL, default `0` | Times acquired from marketplace |

**Unique constraint**: `(objective_category, soul_id, version)` -- one DNA entry per soul per category per version.

#### `negative_signal_register`
Records of failed or harmful bot behaviors, used to prevent repeating mutations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Record ID |
| `soul_id` | uuid | NOT NULL, FK -> `bot_souls.id` | Source soul |
| `bot_id` | uuid | NOT NULL | Logical FK to `bots.id` |
| `execution_id` | uuid | FK -> `executions.id` SET NULL | Source execution |
| `failure_type` | varchar(50) | NOT NULL | `retirement`, `budget_overrun`, `guardrail_violation`, `quality_floor_breach` |
| `directive_failure_summary` | text | nullable | Which directives failed |
| `mutation_blacklist` | jsonb | nullable | Mutations to never apply again |
| `registered_at` | timestamptz | NOT NULL | Registration timestamp |

#### `category_benchmarks`
Per-category performance baselines established by pioneer bots.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Benchmark ID |
| `task_category` | varchar(255) | NOT NULL, UNIQUE | Category name |
| `pioneer_bot_id` | uuid | NOT NULL | Logical FK to `bots.id` |
| `pioneer_soul_id` | uuid | nullable | Logical FK to `bot_souls.id` |
| `pioneer_execution_id` | uuid | NOT NULL | Logical FK to `executions.id` |
| `baseline_composite_score` | numeric(5,2) | NOT NULL | Baseline fitness score |
| `confirmed_run_count` | integer | NOT NULL, default `1` | Runs confirming this benchmark |
| `thin_data_flag` | boolean | NOT NULL, default `true` | Insufficient data for reliable benchmarking |
| `benchmark_mature` | boolean | NOT NULL, default `false` | Benchmark has enough data |
| `standard_promotion` | boolean | NOT NULL, default `false` | Standard promotion enabled for category |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

#### `decision_traces`
Per-agent per-execution decision attribution records for soul analysis. TTL: 90 days, archived before 5M rows.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Record ID |
| `execution_id` | uuid | NOT NULL, FK -> `executions.id` CASCADE | Parent execution |
| `bot_id` | uuid | NOT NULL | Logical FK to `bots.id` |
| `soul_id` | uuid | FK -> `bot_souls.id` | Source soul |
| `decision_id` | uuid | NOT NULL, UNIQUE | Caller-generated idempotency key |
| `decision_type` | varchar(50) | NOT NULL | `tool_call`, `reasoning_branch`, `output_step` |
| `directive_referenced` | text | nullable | Soul directive that influenced the decision |
| `attribution_confidence` | numeric(4,3) | nullable | Confidence 0.000-1.000 |
| `outcome` | varchar(50) | nullable | `success`, `failure`, `partial` |
| `metadata` | jsonb | nullable | Additional context |
| `decided_at` | timestamptz | NOT NULL | When the decision was made |
| `created_at` | timestamptz | NOT NULL | Record creation timestamp |

#### `evolution_campaigns`
Chains multiple executions against the same objective for autonomous improvement (Karpathy Loop).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Campaign ID |
| `objective` | text | NOT NULL | Objective text (snapshotted, identical across all iterations) |
| `project_id` | uuid | nullable | Logical FK to Paperclip projects |
| `max_iterations` | integer | NOT NULL, default `10` | Maximum iteration count |
| `campaign_budget_cap_cents` | integer | nullable | Cumulative cost cap across all iterations |
| `seed_max_bots` | integer | NOT NULL | Bot count per iteration |
| `seed_budget_cap_cents` | integer | NOT NULL | Per-execution budget cap |
| `seed_runtime_limit_seconds` | integer | NOT NULL | Per-execution runtime limit |
| `seed_allowed_tools` | text[] | NOT NULL | Tool allowlist per iteration |
| `seed_llm_provider` | varchar(50) | nullable | LLM provider override |
| `seed_allowed_domains` | text[] | nullable | Domain allowlist |
| `status` | evolution_campaign_status | NOT NULL, default `running` | `running`, `completed_success`, `completed_max`, `halted_regression`, `halted_plateau`, `halted_budget`, `halted_error` |
| `completed_iteration_count` | integer | NOT NULL, default `0` | Completed iterations |
| `best_efs_score` | numeric(5,4) | nullable | Highest EFS score seen |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |
| `stopped_at` | timestamptz | nullable | When campaign was stopped |

#### `evolution_campaign_iterations`
One row per execution in an evolution campaign, tracking EFS scores and deltas.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Iteration ID |
| `campaign_id` | uuid | NOT NULL, FK -> `evolution_campaigns.id` CASCADE | Parent campaign |
| `iteration_num` | integer | NOT NULL | 1-indexed iteration number |
| `execution_id` | uuid | NOT NULL, UNIQUE | Logical FK to `executions.id` |
| `efs_score` | numeric(5,4) | nullable | Execution Fitness Score (null while running) |
| `success_rate` | numeric(5,4) | nullable | Task success rate |
| `cost_efficiency` | numeric(5,4) | nullable | Cost efficiency metric |
| `speed` | numeric(5,4) | nullable | Speed metric |
| `council_health` | numeric(5,4) | nullable | Council confidence health |
| `delta_from_previous` | numeric(6,4) | nullable | Signed delta from previous iteration |
| `halted_reason` | varchar(64) | nullable | Halt reason if this iteration caused halt |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `completed_at` | timestamptz | nullable | When EFS was computed and halt criteria evaluated |

**Unique constraints**: `(campaign_id, iteration_num)`, `(execution_id)`.

#### `learned_skills`
Skills autonomously discovered by agents from decision trace analysis.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Record ID |
| `bot_id` | uuid | NOT NULL, FK -> `bots.id` CASCADE | Discovering bot |
| `soul_id` | uuid | nullable | Logical FK to `bot_souls.id` |
| `execution_id` | uuid | NOT NULL, FK -> `executions.id` CASCADE | Source execution |
| `name` | varchar(255) | NOT NULL | Skill name |
| `category` | varchar(100) | NOT NULL | Skill category |
| `trigger_patterns` | jsonb | NOT NULL, default `[]` | When to activate this skill |
| `procedural_body` | text | NOT NULL | Core procedural knowledge |
| `required_tools` | jsonb | NOT NULL, default `[]` | Tools needed by this skill |
| `confidence_score` | numeric(4,3) | NOT NULL | Discovery confidence 0.000-1.000 |
| `approval_status` | skill_approval_status | NOT NULL, default `pending_review` | `auto_approved`, `pending_review`, `rejected` |
| `source_trace_ids` | jsonb | NOT NULL, default `[]` | Decision trace IDs that sourced this skill |
| `skill_content` | text | NOT NULL | Full SKILL.md content |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `approved_at` | timestamptz | nullable | Approval timestamp |
| `approved_by` | text | nullable | Who approved the skill |

---

### Skill Domain

Tables for skill management, loadouts, and activation tracking.

#### `skills`
User-created skill definitions (SKILL.md files).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Skill ID |
| `user_id` | text | NOT NULL | Logical FK to `user.id` |
| `name` | varchar(255) | NOT NULL | Skill name |
| `description` | text | NOT NULL | Skill description |
| `version` | varchar(50) | NOT NULL, default `1.0.0` | Semantic version |
| `category` | skill_category | NOT NULL, default `other` | `communication`, `analysis`, `creation`, `automation`, `research`, `coordination`, `monitoring`, `other` |
| `triggers` | jsonb | NOT NULL, default `[]` | Activation trigger patterns |
| `requires_tools` | jsonb | NOT NULL, default `[]` | Required tool dependencies |
| `requires_skills` | jsonb | NOT NULL, default `[]` | Required skill dependencies |
| `min_agent_class` | varchar(20) | NOT NULL, default `Novice` | Minimum agent class to equip |
| `content` | text | NOT NULL | Full SKILL.md content |
| `content_hash` | varchar(64) | NOT NULL | SHA-256 for deduplication |
| `source` | skill_source | NOT NULL, default `user_created` | `user_created`, `imported`, `curated` |
| `is_public` | varchar(1) | NOT NULL, default `n` | Public visibility flag |
| `effectiveness_stats` | jsonb | nullable | Aggregated effectiveness metrics |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Unique constraint**: `(user_id, name)`.

#### `agent_skills` (from `agent-skills.ts`)
Company-authored skill definitions with versioning and publishing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Skill ID |
| `company_id` | uuid | NOT NULL | Company/org identifier |
| `skill_name` | varchar(255) | NOT NULL | Skill name |
| `skill_description` | text | NOT NULL | Skill description |
| `skill_content` | text | NOT NULL | Full skill content |
| `metadata` | jsonb | NOT NULL | Category, triggers, tool/skill requirements, min class |
| `version` | integer | NOT NULL, default `1` | Version number |
| `is_published` | boolean | NOT NULL, default `false` | Published to Skill Bazaar |
| `published_at` | timestamptz | nullable | Publication timestamp |
| `source_type` | source_type | NOT NULL, default `authored` | `authored`, `learned`, `acquired` |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Unique constraint**: `(company_id, skill_name, version)`.

#### `agent_skills` (from `skills.ts`)
Junction table linking agents to equipped skills.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Record ID |
| `agent_id` | uuid | NOT NULL | Agent/bot identifier |
| `skill_id` | uuid | NOT NULL, FK -> `skills.id` CASCADE | Equipped skill |
| `equipped_at` | timestamptz | NOT NULL | When skill was equipped |
| `equipped_by` | text | NOT NULL | Who equipped it (user or system) |

**Unique constraint**: `(agent_id, skill_id)`.

> **Note**: There are two `agent_skills` table definitions in the codebase -- one in `agent-skills.ts` (company-authored skills with versioning) and one in `skills.ts` (junction table for agent-skill assignments). These serve different purposes in the skill lifecycle.

#### `skill_loadouts`
Active skill assignments on bots. Capacity scales with agent class (Novice: 3, Understudy: 5, Artisan: 8).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Record ID |
| `bot_id` | uuid | NOT NULL, FK -> `bots.id` CASCADE | Target bot |
| `skill_id` | uuid | NOT NULL, FK -> `agent_skills.id` CASCADE | Equipped skill |
| `is_active` | boolean | NOT NULL, default `true` | Currently active |
| `equipped_at` | timestamptz | NOT NULL | When equipped |
| `removed_at` | timestamptz | nullable | When removed |

**Unique constraint**: `(bot_id, skill_id)`.

#### `skill_activations`
Tracks when skills are activated during executions and their impact on composite score.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Record ID |
| `bot_id` | uuid | NOT NULL, FK -> `bots.id` CASCADE | Activating bot |
| `skill_id` | uuid | NOT NULL, FK -> `agent_skills.id` CASCADE | Activated skill |
| `execution_id` | uuid | NOT NULL | Logical FK to `executions.id` |
| `activated_at` | timestamptz | NOT NULL | Activation timestamp |
| `composite_score_delta` | float | NOT NULL | Score impact (positive = helpful) |
| `classification` | activation_classification | NOT NULL | `positive`, `neutral`, `negative` |
| `consecutive_negative_count` | integer | NOT NULL, default `0` | Consecutive negative activations |

---

### Telemetry and Billing Domain

#### `telemetry`
Per-bot performance metrics collected during execution.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Record ID |
| `execution_id` | uuid | NOT NULL, FK -> `executions.id` CASCADE | Parent execution |
| `bot_id` | uuid | NOT NULL, FK -> `bots.id` CASCADE | Source bot |
| `metric_name` | varchar(255) | NOT NULL | Metric identifier |
| `metric_value` | numeric(12,6) | NOT NULL | Metric value |
| `computed_at` | timestamptz | NOT NULL | Computation timestamp |

#### `billing_events`
Token consumption and cost tracking events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Event ID |
| `execution_id` | uuid | NOT NULL, FK -> `executions.id` CASCADE | Parent execution |
| `bot_id` | uuid | nullable | Logical FK to `bots.id` |
| `project_id` | uuid | nullable | Logical FK to Paperclip projects |
| `event_type` | billing_event_type | NOT NULL | `bot_started`, `bot_stopped`, `tool_invoked`, `execution_completed`, `budget_exceeded` |
| `amount_cents` | integer | nullable | Cost in cents |
| `token_count` | integer | nullable | Token consumption |
| `metadata` | jsonb | nullable | Additional billing context |
| `occurred_at` | timestamptz | NOT NULL | Event timestamp |

---

### Tool Domain

Tables for tool invocation tracking, external tool connections, API registry, and webhook routing.

#### `tool_invocations`
Records of bot tool calls routed through the Tool Gateway.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Record ID |
| `execution_id` | uuid | NOT NULL, FK -> `executions.id` CASCADE | Parent execution |
| `bot_id` | uuid | NOT NULL, FK -> `bots.id` CASCADE | Invoking bot |
| `tool_name` | varchar(50) | NOT NULL | Tool identifier |
| `invocation_id` | uuid | NOT NULL | Unique invocation ID |
| `rejected` | boolean | NOT NULL, default `false` | Whether invocation was rejected |
| `rejection_reason` | varchar(100) | nullable | Why invocation was rejected |
| `duration_ms` | integer | nullable | Execution duration |
| `prompt_tokens` | integer | nullable | Prompt token count |
| `completion_tokens` | integer | nullable | Completion token count |
| `total_tokens` | integer | nullable | Total token count |
| `request_summary` | jsonb | nullable | Request payload summary |
| `response_summary` | jsonb | nullable | Response payload summary |
| `invoked_at` | timestamptz | NOT NULL | Invocation timestamp |

#### `tool_connections`
User-authenticated connections to external tools (OAuth or API key). Credentials are AES-256-GCM encrypted at rest.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Connection ID |
| `user_id` | text | NOT NULL | Logical FK to `user.id` |
| `tool_id` | text | NOT NULL | Tool identifier (e.g., `hubspot`, `slack`) |
| `connection_type` | text | NOT NULL, default `api_key` | `oauth` or `api_key` |
| `status` | text | NOT NULL, default `connected` | `connected`, `expired`, `rate_limited`, `errored`, `disconnected` |
| `display_label` | text | nullable | Human-readable label |
| `encrypted_access_token` | text | nullable | AES-256-GCM encrypted OAuth access token |
| `encrypted_refresh_token` | text | nullable | AES-256-GCM encrypted OAuth refresh token |
| `token_iv` | text | nullable | IV for access token encryption |
| `token_tag` | text | nullable | Auth tag for access token |
| `refresh_iv` | text | nullable | IV for refresh token encryption |
| `refresh_tag` | text | nullable | Auth tag for refresh token |
| `encrypted_api_key` | text | nullable | AES-256-GCM encrypted API key |
| `api_key_iv` | text | nullable | IV for API key encryption |
| `api_key_tag` | text | nullable | Auth tag for API key |
| `key_version` | integer | NOT NULL, default `1` | Encryption key version for rotation |
| `token_expires_at` | timestamptz | nullable | OAuth token expiry |
| `scopes` | text | nullable | Comma-separated OAuth scopes |
| `rate_limit_reset_at` | timestamptz | nullable | When rate limit resets |
| `last_used_at` | timestamptz | nullable | Last usage timestamp |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Unique constraint**: `(user_id, tool_id)`.

#### `tool_invocation_logs`
Detailed logs for Tool Nexus invocations (distinct from `tool_invocations` which tracks bot-initiated calls during executions).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Log ID |
| `tool_id` | text | NOT NULL | Tool identifier |
| `action` | text | NOT NULL | Action name (e.g., `hubspot:create-contact`) |
| `agent_id` | text | nullable | Invoking agent (null for user-initiated test calls) |
| `user_id` | text | NOT NULL | Logical FK to `user.id` |
| `connection_id` | uuid | NOT NULL | Logical FK to `tool_connections.id` |
| `latency_ms` | integer | nullable | Call latency |
| `success` | boolean | NOT NULL | Whether the call succeeded |
| `error_message` | text | nullable | Error details |
| `request_summary` | text | nullable | First 500 chars of request |
| `response_summary` | text | nullable | First 500 chars of response |
| `created_at` | timestamptz | NOT NULL | Log timestamp |

#### `tool_registry`
OpenAPI/Swagger endpoint definitions imported for Tool Nexus invocation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Entry ID |
| `user_id` | text | NOT NULL | Logical FK to `user.id` |
| `spec_id` | uuid | NOT NULL | Groups endpoints from the same OpenAPI import |
| `spec_title` | text | NOT NULL | API spec title |
| `spec_version` | text | nullable | API spec version |
| `spec_url` | text | nullable | Source URL of the spec |
| `base_url` | text | NOT NULL | Resolved server URL for invocations |
| `operation_id` | text | nullable | OpenAPI operationId |
| `method` | text | NOT NULL | HTTP method (`get`, `post`, `put`, `patch`, `delete`) |
| `path` | text | NOT NULL | Endpoint path (e.g., `/contacts/{contactId}`) |
| `summary` | text | nullable | Operation summary |
| `description` | text | nullable | Operation description |
| `parameters` | jsonb | nullable | Query, path, and header parameters |
| `request_body` | jsonb | nullable | Dereferenced request body schema |
| `response_schema` | jsonb | nullable | Dereferenced 200 response schema |
| `tags` | jsonb | default `[]` | OpenAPI tags |
| `is_enabled` | boolean | NOT NULL, default `true` | Whether endpoint is active |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Unique constraint**: `(spec_id, method, path)`.

#### `webhook_routing_rules`
Rules for routing incoming webhooks to specific agents.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Rule ID |
| `user_id` | text | NOT NULL | Logical FK to `user.id` |
| `connection_id` | uuid | NOT NULL | Logical FK to `tool_connections.id` |
| `tool_id` | text | NOT NULL | Source tool identifier |
| `event_type` | text | NOT NULL | Event type filter (e.g., `deal.created`, `message`) |
| `condition` | text | nullable | Optional JSON/text match condition |
| `assign_to_agent_id` | text | nullable | Logical FK to Paperclip agents table |
| `is_active` | boolean | NOT NULL, default `true` | Rule is active |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

---

### Marketplace Domain

#### `marketplace_reviews`
Reviews for Akashic Library (souls) and Skill Bazaar (skills) listings. Uses polymorphic `target_id` + `target_type`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | uuid | PK | Review ID |
| `user_id` | text | NOT NULL | Logical FK to `user.id` |
| `target_id` | uuid | NOT NULL | FK to `dna_store.id` (soul) or `skills.id` (skill) |
| `target_type` | text | NOT NULL | `soul` or `skill` |
| `rating` | integer | NOT NULL | Star rating |
| `review_text` | text | nullable | Review body |
| `created_at` | timestamptz | NOT NULL | Creation timestamp |
| `updated_at` | timestamptz | NOT NULL | Last update timestamp |

**Unique constraint**: `(user_id, target_id)` -- one review per user per item.

---

## Logical Foreign Key Summary

The following columns are intentional logical foreign keys (no `references()` in Drizzle) to avoid circular TypeScript inference at module load time:

| Table | Column | References |
|-------|--------|------------|
| `bots` | `soul_id` | `bot_souls.id` |
| `bots` | `paperclip_agent_id` | Paperclip `agents.id` |
| `tasks` | `claimed_by_bot_id` | `bots.id` |
| `executions` | `ring_leader_run_id` | `ring_leader_runs.id` |
| `executions` | `evolution_campaign_id` | `evolution_campaigns.id` |
| `executions` | `project_id` | Paperclip `projects` |
| `objectives` | `project_id` | Paperclip `projects` |
| `bot_souls` | `bot_id` | `bots.id` |
| `bot_souls` | `execution_id` | `executions.id` |
| `council_verdicts` | `bot_id` | `bots.id` |
| `council_verdicts` | `soul_id` | `bot_souls.id` |
| `agent_classes` | `bot_id` | `bots.id` |
| `agent_classes` | `last_verdict_id` | `council_verdicts.id` |
| `dna_store` | `bot_id` | `bots.id` |
| `dna_store` | `soul_id` | `bot_souls.id` |
| `negative_signal_register` | `bot_id` | `bots.id` |
| `category_benchmarks` | `pioneer_bot_id` | `bots.id` |
| `category_benchmarks` | `pioneer_soul_id` | `bot_souls.id` |
| `category_benchmarks` | `pioneer_execution_id` | `executions.id` |
| `decision_traces` | `bot_id` | `bots.id` |
| `ring_leader_runs` | `soul_id` | `bot_souls.id` |
| `evolution_campaign_iterations` | `execution_id` | `executions.id` |
| `learned_skills` | `soul_id` | `bot_souls.id` |
| `billing_events` | `bot_id` | `bots.id` |
| `billing_events` | `project_id` | Paperclip `projects` |
| `evolution_campaigns` | `project_id` | Paperclip `projects` |
| `tool_connections` | `user_id` | `user.id` |
| `tool_invocation_logs` | `connection_id` | `tool_connections.id` |
| `tool_invocation_logs` | `user_id` | `user.id` |
| `tool_registry` | `user_id` | `user.id` |
| `webhook_routing_rules` | `user_id` | `user.id` |
| `webhook_routing_rules` | `connection_id` | `tool_connections.id` |
| `webhook_routing_rules` | `assign_to_agent_id` | Paperclip `agents` |
| `marketplace_reviews` | `user_id` | `user.id` |
| `marketplace_reviews` | `target_id` | `dna_store.id` or `skills.id` (polymorphic) |
| `skill_activations` | `execution_id` | `executions.id` |
| `skills` | `user_id` | `user.id` |

## PostgreSQL Enums

| Enum | Values |
|------|--------|
| `bot_status` | `spawning`, `idle`, `working`, `stopping`, `stopped`, `failed` |
| `task_status` | `pending`, `claimed`, `completed`, `failed` |
| `execution_status` | `pre_flight`, `queued`, `running`, `paused`, `stopped`, `completed`, `failed` |
| `verdict_type` | `Promote`, `Maintain`, `Monitor`, `Demote`, `Retire` |
| `verdict_status` | `pending`, `confirmed`, `rejected` |
| `agent_class` | `Novice`, `Understudy`, `Artisan`, `Retired` |
| `billing_event_type` | `bot_started`, `bot_stopped`, `tool_invoked`, `execution_completed`, `budget_exceeded` |
| `ring_leader_status` | `assembling`, `spawning`, `coordinating`, `synthesizing`, `completed`, `failed` |
| `source_type` | `authored`, `learned`, `acquired` |
| `activation_classification` | `positive`, `neutral`, `negative` |
| `skill_category` | `communication`, `analysis`, `creation`, `automation`, `research`, `coordination`, `monitoring`, `other` |
| `skill_source` | `user_created`, `imported`, `curated` |
| `evolution_campaign_status` | `running`, `completed_success`, `completed_max`, `halted_regression`, `halted_plateau`, `halted_budget`, `halted_error` |
| `skill_approval_status` | `auto_approved`, `pending_review`, `rejected` |
