import type { UUID, ISOTimestamp } from './common';

export type SourceType = 'authored' | 'learned' | 'acquired';

export type ActivationClassification = 'positive' | 'neutral' | 'negative';

export interface SkillMetadata {
  category: string;
  triggers: string[];
  requires_tools: string[];
  requires_skills: string[];
  min_agent_class: 'Novice' | 'Understudy' | 'Artisan';
}

export interface AgentSkill {
  id: UUID;
  companyId: UUID;
  skillName: string;
  skillDescription: string;
  skillContent: string;
  metadata: SkillMetadata;
  version: number;
  isPublished: boolean;
  publishedAt: ISOTimestamp | null;
  sourceType: SourceType;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

export type NewAgentSkill = Omit<AgentSkill, 'id' | 'publishedAt' | 'createdAt' | 'updatedAt'>;

export interface SkillLoadout {
  id: UUID;
  botId: UUID;
  skillId: UUID;
  isActive: boolean;
  equippedAt: ISOTimestamp;
  removedAt: ISOTimestamp | null;
}

export type NewSkillLoadout = Omit<SkillLoadout, 'id' | 'equippedAt' | 'removedAt'>;

export interface SkillActivation {
  id: UUID;
  botId: UUID;
  skillId: UUID;
  executionId: UUID;
  activatedAt: ISOTimestamp;
  compositeScoreDelta: number;
  classification: ActivationClassification;
  consecutiveNegativeCount: number;
}

export type NewSkillActivation = Omit<SkillActivation, 'id' | 'activatedAt'>;
