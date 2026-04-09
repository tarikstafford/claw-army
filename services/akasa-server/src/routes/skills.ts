import { Router } from 'express';
import { db, bots } from '@claw/db';
import { eq, and, desc, sql, isNotNull, inArray } from 'drizzle-orm';

export function skillsRouter(): Router {
  const router = Router();

  router.get('/skills', async (_req, res, next) => {
    try {
      const skills = [
        {
          id: 'skill-1',
          companyId: 'demo-company',
          name: 'Precision Targeting',
          category: 'execution',
          source: 'authored' as const,
          triggerPatterns: ['when accuracy < 0.8', 'on low confidence'],
          effectivenessScore: 0.87,
          effectivenessClassification: 'high' as const,
          confidence: 0.95,
          content: `---
name: Precision Targeting
category: execution
triggers:
  - accuracy < 0.8
  - low confidence
---

# Precision Targeting

Use conservative, high-verification approaches when confidence is low.`,
          isApproved: true,
          createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'skill-2',
          companyId: 'demo-company',
          name: 'Broad Outreach',
          category: 'communication',
          source: 'learned' as const,
          triggerPatterns: ['on bulk operations', 'when scale matters'],
          effectivenessScore: 0.72,
          effectivenessClassification: 'medium' as const,
          confidence: 0.61,
          content: `---
name: Broad Outreach
category: communication
triggers:
  - bulk operations
  - scale priority
---

# Broad Outreach

Optimize for throughput. Speed over precision on non-critical paths.`,
          isApproved: false,
          createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'skill-3',
          companyId: 'demo-company',
          name: 'Risk aware Planning',
          category: 'planning',
          source: 'acquired' as const,
          triggerPatterns: ['before major decisions', 'on uncertain outcomes'],
          effectivenessScore: 0.91,
          effectivenessClassification: 'high' as const,
          confidence: 0.88,
          content: `---
name: Risk aware Planning
category: planning
triggers:
  - major decisions
  - uncertain outcomes
---

# Risk-aware Planning

Always identify failure modes before committing to a path.`,
          isApproved: true,
          createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      res.json(skills);
    } catch (err) {
      next(err);
    }
  });

  router.get('/skills/pending', async (_req, res, next) => {
    try {
      const pending = [
        {
          id: 'pending-1',
          botId: 'bot-abc',
          skillName: 'Broad Outreach',
          confidence: 0.61,
          learnedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        },
      ];
      res.json(pending);
    } catch (err) {
      next(err);
    }
  });

  router.post('/skills/:skillId/approve', async (req, res, next) => {
    try {
      const { skillId } = req.params;
      res.json({ id: skillId, isApproved: true, updatedAt: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  });

  router.get('/evolution/bots/:botId/skills/loadout', async (req, res, next) => {
    try {
      const { botId } = req.params;
      const loadout = {
        botId,
        equippedSkillIds: ['skill-1', 'skill-3'],
        capacity: 5,
      };
      res.json(loadout);
    } catch (err) {
      next(err);
    }
  });

  router.post('/evolution/bots/:botId/skills/equip', async (req, res, next) => {
    try {
      const { botId } = req.params;
      const { skillId } = req.body;
      const loadout = {
        botId,
        equippedSkillIds: ['skill-1', 'skill-3', skillId],
        capacity: 5,
      };
      res.json(loadout);
    } catch (err) {
      next(err);
    }
  });

  router.post('/evolution/bots/:botId/skills/unequip', async (req, res, next) => {
    try {
      const { botId } = req.params;
      const { skillId } = req.body;
      const loadout = {
        botId,
        equippedSkillIds: ['skill-1'],
        capacity: 5,
      };
      res.json(loadout);
    } catch (err) {
      next(err);
    }
  });

  router.put('/evolution/bots/:botId/skills/reorder', async (req, res, next) => {
    try {
      const { botId } = req.params;
      const { skillIds } = req.body;
      res.json({ botId, equippedSkillIds: skillIds, capacity: 5 });
    } catch (err) {
      next(err);
    }
  });

  router.get('/evolution/bots/:botId/skills/conflicts', async (req, res, next) => {
    try {
      const conflicts = [
        {
          skillA: 'skill-1',
          skillB: 'skill-2',
          conflictType: 'soul' as const,
          description: 'Precision Targeting and Broad Outreach have conflicting optimization goals.',
        },
      ];
      res.json(conflicts);
    } catch (err) {
      next(err);
    }
  });

  router.get('/skills/heatmap', async (_req, res, next) => {
    try {
      const heatmap = [
        { botId: 'bot-1', botName: 'indra-alpha', skillId: 'skill-1', skillName: 'Precision Targeting', classification: 'high' },
        { botId: 'bot-1', botName: 'indra-alpha', skillId: 'skill-2', skillName: 'Broad Outreach', classification: 'low' },
        { botId: 'bot-2', botName: 'mira-beta', skillId: 'skill-1', skillName: 'Precision Targeting', classification: 'medium' },
        { botId: 'bot-2', botName: 'mira-beta', skillId: 'skill-3', skillName: 'Risk-aware Planning', classification: 'high' },
      ];
      res.json(heatmap);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
