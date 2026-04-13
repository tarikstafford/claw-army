import type { VerdictType } from '@claw/shared-types';

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface Toast {
  id: string;
  type: string;
  text: string;
}

export interface PendingVerdict {
  id: string;
  botId: string;
  verdictType: VerdictType;
  verdictSummary: string;
  weightedConfidenceScore: string | null;
  performanceJudgeOutput: string | null;
  soulAnalystOutput: string | null;
  devilsAdvocateOutput: string | null;
  createdAt: string;
}

export type BatchVerdictProcessedItem =
  | { id: string; success: true; action: 'confirmed' | 'rejected' }
  | { id: string; success: false; error: string };

export interface BatchVerdictResult {
  processed: BatchVerdictProcessedItem[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}
