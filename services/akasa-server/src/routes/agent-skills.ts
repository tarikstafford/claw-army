import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, skills, agentSkills, agentClasses, AGENT_CLASS_SKILL_CAPACITY } from '@claw/db';
import { eq, and, desc, count } from 'drizzle-orm';

interface EquipSkillBody {
  equippedBy: string;
}

export function agentSkillsRouter(): Router {
  const router = Router();

  router.get('/:agentId/skills', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;

      const skillRows = await db
        .select({
          skillId: agentSkills.skillId,
          equippedAt: agentSkills.equippedAt,
          equippedBy: agentSkills.equippedBy,
          skillName: skills.name,
          skillDescription: skills.description,
          skillCategory: skills.category,
          skillVersion: skills.version,
        })
        .from(agentSkills)
        .innerJoin(skills, eq(agentSkills.skillId, skills.id))
        .where(eq(agentSkills.agentId, agentId))
        .orderBy(desc(agentSkills.equippedAt));

      res.json(skillRows);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:agentId/skills/:skillId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId, skillId } = req.params;
      const body = req.body as EquipSkillBody;

      if (!body.equippedBy) {
        res.status(400).json({ error: 'equippedBy is required' });
        return;
      }

      const skillRows = await db.select().from(skills).where(eq(skills.id, skillId)).limit(1);
      if (skillRows.length === 0) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      const agentClassRows = await db
        .select()
        .from(agentClasses)
        .where(eq(agentClasses.botId, agentId))
        .limit(1);

      if (agentClassRows.length === 0) {
        res.status(404).json({ error: 'Agent class not found for this agent' });
        return;
      }

      const agentClass = agentClassRows[0]!.currentClass;
      const capacity = AGENT_CLASS_SKILL_CAPACITY[agentClass] ?? 0;

      const currentCountResult = await db
        .select({ count: count() })
        .from(agentSkills)
        .where(eq(agentSkills.agentId, agentId));

      const currentCount = Number(currentCountResult[0]?.count ?? 0);

      if (currentCount >= capacity) {
        res.status(400).json({
          error: `Capacity exceeded. ${agentClass} agents can equip up to ${capacity} skills.`,
          capacity,
          currentCount,
        });
        return;
      }

      const insert = {
        agentId,
        skillId,
        equippedBy: body.equippedBy,
      };

      try {
        const rows = await db.insert(agentSkills).values(insert).returning();
        res.status(201).json(rows[0]);
      } catch (insertErr) {
        const msg = (insertErr as Error).message ?? '';
        if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('UNIQUE')) {
          res.status(409).json({ error: 'Skill already equipped to this agent' });
          return;
        }
        throw insertErr;
      }
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:agentId/skills/:skillId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId, skillId } = req.params;

      const deleted = await db
        .delete(agentSkills)
        .where(and(eq(agentSkills.agentId, agentId), eq(agentSkills.skillId, skillId)))
        .returning();

      if (deleted.length === 0) {
        res.status(404).json({ error: 'Equipped skill not found for this agent' });
        return;
      }

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
