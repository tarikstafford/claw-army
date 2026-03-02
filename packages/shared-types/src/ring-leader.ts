import type { UUID, Cents } from './common';

/** Ring Leader lifecycle status */
export type RingLeaderStatus = 'assembling' | 'spawning' | 'coordinating' | 'synthesizing' | 'completed' | 'failed';

export const RING_LEADER_STATUSES: readonly RingLeaderStatus[] = [
  'assembling', 'spawning', 'coordinating', 'synthesizing', 'completed', 'failed',
] as const;

/** Campaign type affects soul selection weighting (PRD 4.1) */
export type CampaignType = 'ad_hoc' | 'campaign';

/** Task complexity tier (PRD 3, ORCH-01) */
export type TaskComplexity = 'low' | 'medium' | 'high';

/** A single node in the task graph DAG (PRD Section 3) */
export interface TaskGraphNode {
  taskId: string;
  description: string;
  complexity: TaskComplexity;
  requiredTools: string[];
  dependencies: string[];  // taskId references
  parallelizable: boolean;
  minPopulation: number;       // minimum 3 per BUDG-03
  recommendedPopulation: number;
}

/** Full task graph with adjacency map (ORCH-01) */
export interface TaskGraph {
  tasks: TaskGraphNode[];
  dag: Record<string, string[]>;  // taskId -> downstream taskId[]
}

/** Mission brief passed from Orchestrator to Ring Leader (ORCH-03, PRD Section 3) */
export interface RingLeaderMissionBrief {
  objective: string;
  taskGraph: TaskGraph;
  toolGrants: string[];
  budgetCapCents: Cents;
  runtimeLimitSeconds: number;
  campaignType: CampaignType;
  runId: UUID;
}

/** Soul source in population manifest (PRD 5.2) */
export type SoulSource = 'library' | 'generated' | 'mutated';

/** A single soul assignment in the population manifest (SOUL-08, PRD 5.2) */
export interface SoulSelectionEntry {
  soulId: UUID;
  agentClass: 'Artisan' | 'Understudy' | 'Novice';
  source: SoulSource;
  parentSoulId: UUID | null;
  mutationApplied: string | null;
  selectionRationale: string;
  differentiationScore: number;  // cosine distance from nearest soul in same-task population
}

/** Population manifest for a single task (PRD 5.2) */
export interface PopulationManifest {
  taskId: string;
  taskDescription: string;
  assignedSouls: SoulSelectionEntry[];
  pioneerFlag: boolean;
  varianceIntent: string | null;  // rationale if same task assigned to diverse souls
}

/** Per-task state in the live run state object (PRD 7.1, COORD-01) */
export type TaskRunStatus = 'queued' | 'active' | 'completing' | 'complete' | 'failed';

export interface TaskState {
  status: TaskRunStatus;
  activeAgents: UUID[];     // session IDs
  completedAgents: UUID[];
  failedAgents: UUID[];
  outputQualitySignal: number | null;
}

/** Live run state maintained during coordination (PRD 7.1, COORD-01) */
export interface RingLeaderRunState {
  runId: UUID;
  elapsedTimeSeconds: number;
  budgetConsumedCents: Cents;
  taskStates: Record<string, TaskState>;  // keyed by taskId
  objectiveDriftScore: number;  // 0 to 1, 0 = fully aligned
  anomalies: string[];
}

/** Per-task summary in synthesis (PRD 8.1) */
export interface TaskSummary {
  taskId: string;
  completed: boolean;
  topPerformingSoulId: UUID | null;
  outputQualitySignal: number | null;
  anomalies: string[];
}

/** Run synthesis produced by Ring Leader after completion (SYNTH-01 through SYNTH-04, PRD 8.1) */
export interface RingLeaderSynthesis {
  runId: UUID;
  objective: string;
  objectiveAchieved: boolean;
  achievementRationale: string;
  taskSummary: TaskSummary[];
  intelligenceRoutingEvents: number;
  reallocationEvents: number;
  reanchoringEvents: number;
  soulSelectionRetrospective: string;  // SYNTH-02
  budgetVarianceCents: Cents;          // actual - projected
  recommendedLibraryWrites: UUID[];    // soul IDs to promote/retain (SYNTH-03)
  pioneerEvents: string[];             // task IDs (SYNTH-03)
  ringLeaderSelfAssessment: string;    // SYNTH-04
}

/** Coordination quality dimensions (FIT-01, PRD 9.1) */
export interface CoordinationScore {
  collectiveOutcome: number;           // weight 40%
  driftPrevention: number;             // weight 25%
  reallocationEffectiveness: number;   // weight 20%
  budgetManagement: number;            // weight 15%
}

/** Coordination dimension weights */
export const COORDINATION_WEIGHTS = {
  collectiveOutcome: 0.40,
  driftPrevention: 0.25,
  reallocationEffectiveness: 0.20,
  budgetManagement: 0.15,
} as const;

/** Soul selection quality dimensions (FIT-02, PRD 9.2) */
export interface SoulSelectionScore {
  librarySearchQuality: number;
  differentiationEffectiveness: number;
  mutationDecisionQuality: number;
  pioneerHandling: number;
  selectionRetrospectiveQuality: number;
}

/** Composite Ring Leader fitness score (FIT-03, PRD 9.3) */
export interface RingLeaderFitnessScore {
  coordinationScore: CoordinationScore;
  soulSelectionScore: SoulSelectionScore;
  compositeScore: number;  // coordination 60% + soul selection 40%
}

/** Fitness category weights (FIT-03) */
export const FITNESS_CATEGORY_WEIGHTS = {
  coordination: 0.60,
  soulSelection: 0.40,
} as const;

/** Ring Leader promotion thresholds (FIT-05, PRD Section 10) */
export const RING_LEADER_PROMOTION_THRESHOLDS = {
  noviceToUnderstudy: { minRuns: 4, minConfidence: 0.68 },
  understudyToArtisan: { minRuns: 9, minConfidence: 0.85, minSoulSelectionScore: 0.75, qualifyingRunsRequired: 6 },
} as const;

/** Budget degradation tiers (COORD-08, PRD 7.5) */
export type BudgetDegradationTier = 'normal' | 'deprioritize' | 'consolidate' | 'wrap_up' | 'hard_stop';

export const BUDGET_DEGRADATION_TIERS: readonly BudgetDegradationTier[] = [
  'normal', 'deprioritize', 'consolidate', 'wrap_up', 'hard_stop',
] as const;

/** Hard stop budget threshold (PRD 7.5) */
export const BUDGET_HARD_STOP_THRESHOLD = 0.95;

/** Drift reanchoring threshold (COORD-06, PRD 7.4) */
export const DRIFT_REANCHORING_THRESHOLD = 0.35;

/** Minimum agents per task (BUDG-03) */
export const MIN_AGENTS_PER_TASK = 3;

/** Soul similarity threshold for library search (SOUL-01) */
export const SOUL_SEARCH_SIMILARITY_THRESHOLD = 0.78;

/** Soul differentiation threshold (SOUL-04) */
export const SOUL_DIFFERENTIATION_THRESHOLD = 0.85;
