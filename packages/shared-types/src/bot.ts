import type { UUID, ISOTimestamp } from './common';

/** Mirrors the bot_status pgEnum in packages/db/src/schema/bots.ts */
export type BotStatus =
  | 'spawning'
  | 'idle'
  | 'working'
  | 'stopping'
  | 'stopped'
  | 'failed';

/** Runtime-iterable array of all bot status values */
export const BOT_STATUSES: readonly BotStatus[] = [
  'spawning',
  'idle',
  'working',
  'stopping',
  'stopped',
  'failed',
] as const;

/**
 * Domain entity for a bot within an execution.
 * Mirrors the bots table shape without importing Drizzle.
 */
export interface Bot {
  id: UUID;
  executionId: UUID;
  status: BotStatus;
  containerId: string | null;
  imageTag: string;
  startedAt: ISOTimestamp | null;
  stoppedAt: ISOTimestamp | null;
  lastHeartbeatAt: ISOTimestamp | null;
  tasksClaimed: number;
  tasksCompleted: number;
  tasksFailed: number;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

/** Input type for creating a new bot */
export type NewBot = Omit<Bot, 'id' | 'status' | 'containerId' | 'startedAt' | 'stoppedAt' | 'lastHeartbeatAt' | 'tasksClaimed' | 'tasksCompleted' | 'tasksFailed' | 'createdAt' | 'updatedAt'>;
