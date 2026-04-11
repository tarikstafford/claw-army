import { Router, type Request, type Response, type NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { db, skills, agentSkills, agentClasses, bots } from '@claw/db';
import { eq, and, desc, sql, count } from 'drizzle-orm';

const CAPACITY_BY_CLASS: Record<string, number> = {
  Novice: 3,
  Understudy: 5,
  Artisan: 8,
  Retired: 0,
};

interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  category?: string;
  triggers?: string[];
  requires_tools?: string[];
  requires_skills?: string[];
  min_agent_class?: string;
}

interface CreateSkillBody {
  userId: string;
  content: string;
  source?: 'user' | 'library';
}

interface UpdateSkillBody {
  content?: string;
}

interface EquipSkillBody {
  equippedBy: string;
}

function parseYamlFrontmatter(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error('Missing YAML frontmatter delimiter (---)');
  }

  const fmText = fmMatch[1] ?? '';
  const body = fmMatch[2] ?? '';
  const frontmatter: SkillFrontmatter = {
    name: '',
    description: '',
  };

  for (const line of fmText.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (key === 'triggers' || key === 'requires_tools' || key === 'requires_skills') {
      const parsed = value.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      (frontmatter as unknown as Record<string, unknown>)[key] = parsed.filter(Boolean);
    } else if (key === 'name' || key === 'description') {
      (frontmatter as unknown as Record<string, unknown>)[key] = value.replace(/^["']|["']$/g, '');
    } else {
      (frontmatter as unknown as Record<string, unknown>)[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  return { frontmatter, body };
}

function validateSkillFormat(content: string): SkillFrontmatter {
  const { frontmatter, body } = parseYamlFrontmatter(content);

  if (!frontmatter.name || typeof frontmatter.name !== 'string' || frontmatter.name.length === 0) {
    throw new Error('frontmatter.name is required and must be a non-empty string');
  }

  if (!frontmatter.description || typeof frontmatter.description !== 'string') {
    throw new Error('frontmatter.description is required');
  }

  if (frontmatter.triggers && Array.isArray(frontmatter.triggers)) {
    for (const trigger of frontmatter.triggers) {
      if (!isValidTriggerPattern(trigger)) {
        throw new Error(`Invalid trigger pattern: ${trigger}`);
      }
    }
  }

  if (frontmatter.min_agent_class) {
    if (!['Novice', 'Understudy', 'Artisan'].includes(frontmatter.min_agent_class)) {
      throw new Error(`Invalid min_agent_class: ${frontmatter.min_agent_class}. Must be Novice, Understudy, or Artisan`);
    }
  }

  const sections = body.trim().split(/\n#{1,3}\s+/);
  if (sections.length < 2) {
    throw new Error('Skill content must have at least two sections (metadata, body, or references)');
  }

  return frontmatter;
}

function isValidTriggerPattern(pattern: string): boolean {
  if (!pattern || typeof pattern !== 'string') return false;

  if (pattern.startsWith('glob:') || pattern.startsWith('regex:')) {
    const inner = pattern.slice(pattern.indexOf(':') + 1);
    if (pattern.startsWith('regex:')) {
      try {
        new RegExp(inner);
        return true;
      } catch {
        return false;
      }
    }
    return inner.length > 0;
  }

  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function skillsRouter(): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.query['userId'] as string | undefined;
      const category = req.query['category'] as string | undefined;
      const source = req.query['source'] as string | undefined;

      if (!userId) {
        res.status(400).json({ error: 'userId query parameter is required' });
        return;
      }

      const conditions = [eq(skills.userId, userId)];
      if (category) conditions.push(eq(skills.category, category as typeof skills.category.enumValues[number]));
      if (source) conditions.push(eq(skills.source, source as typeof skills.source.enumValues[number]));

      const rows = await db
        .select()
        .from(skills)
        .where(and(...conditions))
        .orderBy(desc(skills.createdAt));

      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateSkillBody;

      if (!body.userId || typeof body.userId !== 'string') {
        res.status(400).json({ error: 'userId is required and must be a string' });
        return;
      }

      if (!body.content || typeof body.content !== 'string') {
        res.status(400).json({ error: 'content is required and must be a string' });
        return;
      }

      let frontmatter: SkillFrontmatter;
      try {
        frontmatter = validateSkillFormat(body.content);
      } catch (validationErr) {
        res.status(400).json({ error: `Invalid skill format: ${(validationErr as Error).message}` });
        return;
      }

      const contentHash = computeContentHash(body.content);

      const existing = await db
        .select({ count: count() })
        .from(skills)
        .where(and(eq(skills.userId, body.userId), eq(skills.name, frontmatter.name)))
        .limit(1);

      if (existing[0]!.count > 0) {
        res.status(409).json({ error: `Skill with name "${frontmatter.name}" already exists for this user` });
        return;
      }

      const insert: typeof skills.$inferInsert = {
        userId: body.userId,
        name: frontmatter.name,
        description: frontmatter.description,
        version: frontmatter.version ?? '1.0.0',
        category: (frontmatter.category ?? 'general') as typeof skills.category.enumValues[number],
        triggers: frontmatter.triggers ?? [],
        requiresTools: frontmatter.requires_tools ?? [],
        requiresSkills: frontmatter.requires_skills ?? [],
        minAgentClass: frontmatter.min_agent_class ?? 'Novice',
        content: body.content,
        contentHash,
        source: body.source ?? 'user',
      };

      const rows = await db.insert(skills).values(insert).returning();
      const created = rows[0];
      if (!created) {
        res.status(500).json({ error: 'Failed to create skill' });
        return;
      }

      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Skill ID is required' });
        return;
      }

      const rows = await db
        .select()
        .from(skills)
        .where(eq(skills.id, id))
        .limit(1);

      if (rows.length === 0) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      res.json(rows[0]);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const body = req.body as UpdateSkillBody;

      if (!id) {
        res.status(400).json({ error: 'Skill ID is required' });
        return;
      }

      if (!body.content || typeof body.content !== 'string') {
        res.status(400).json({ error: 'content is required and must be a string' });
        return;
      }

      const existing = await db
        .select()
        .from(skills)
        .where(eq(skills.id, id))
        .limit(1);

      if (existing.length === 0) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      let frontmatter: SkillFrontmatter;
      try {
        frontmatter = validateSkillFormat(body.content);
      } catch (validationErr) {
        res.status(400).json({ error: `Invalid skill format: ${(validationErr as Error).message}` });
        return;
      }

      const contentHash = computeContentHash(body.content);

      const updated = await db
        .update(skills)
        .set({
          name: frontmatter.name,
          description: frontmatter.description,
          version: frontmatter.version ?? existing[0]!.version,
          category: (frontmatter.category ?? existing[0]!.category) as typeof skills.category.enumValues[number],
          triggers: frontmatter.triggers ?? [],
          requiresTools: frontmatter.requires_tools ?? [],
          requiresSkills: frontmatter.requires_skills ?? [],
          minAgentClass: frontmatter.min_agent_class ?? existing[0]!.minAgentClass,
          content: body.content,
          contentHash,
          updatedAt: new Date(),
        })
        .where(eq(skills.id, id))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      res.json(updated[0]);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Skill ID is required' });
        return;
      }

      const deleted = await db
        .delete(skills)
        .where(eq(skills.id, id))
        .returning();

      if (deleted.length === 0) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function agentSkillsRouter(): Router {
  const router = Router();

  router.get('/:agentId/skills', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;

      if (!agentId) {
        res.status(400).json({ error: 'agentId is required' });
        return;
      }

      const equipped = await db
        .select({
          agentSkill: agentSkills,
          skill: skills,
        })
        .from(agentSkills)
        .innerJoin(skills, eq(agentSkills.skillId, skills.id))
        .where(eq(agentSkills.botId, agentId))
        .orderBy(desc(agentSkills.equippedAt));

      res.json(
        equipped.map((row: typeof equipped[number]) => ({
          ...row.skill,
          equippedAt: row.agentSkill.equippedAt,
          equippedBy: row.agentSkill.equippedBy,
        })),
      );
    } catch (err) {
      next(err);
    }
  });

  router.post('/:agentId/skills/:skillId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId, skillId } = req.params;
      const body = req.body as EquipSkillBody;

      if (!agentId || !skillId) {
        res.status(400).json({ error: 'agentId and skillId are required' });
        return;
      }

      if (!body.equippedBy || typeof body.equippedBy !== 'string') {
        res.status(400).json({ error: 'equippedBy is required and must be a string' });
        return;
      }

      const botRows = await db
        .select()
        .from(bots)
        .where(eq(bots.id, agentId))
        .limit(1);

      if (botRows.length === 0) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      const skillRows = await db
        .select()
        .from(skills)
        .where(eq(skills.id, skillId))
        .limit(1);

      if (skillRows.length === 0) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      const agentClassRows = await db
        .select()
        .from(agentClasses)
        .where(eq(agentClasses.botId, agentId))
        .limit(1);

      const currentClass = agentClassRows[0]?.currentClass ?? 'Novice';
      const maxCapacity = CAPACITY_BY_CLASS[currentClass] ?? 3;

      const currentCount = await db
        .select({ count: count() })
        .from(agentSkills)
        .where(eq(agentSkills.botId, agentId))
        .limit(1);

      if (currentCount[0]!.count >= maxCapacity) {
        res.status(400).json({
          error: `Capacity exceeded. ${currentClass} agents can equip up to ${maxCapacity} skills.`,
          currentClass,
          maxCapacity,
          currentCount: currentCount[0]!.count,
        });
        return;
      }

      const existingEquip = await db
        .select()
        .from(agentSkills)
        .where(and(eq(agentSkills.botId, agentId), eq(agentSkills.skillId, skillId)))
        .limit(1);

      if (existingEquip.length > 0) {
        res.status(409).json({ error: 'Skill is already equipped to this agent' });
        return;
      }

      const insert: typeof agentSkills.$inferInsert = {
        botId: agentId,
        skillId,
        equippedBy: body.equippedBy,
      };

      const rows = await db.insert(agentSkills).values(insert).returning();
      const equipped = rows[0];
      if (!equipped) {
        res.status(500).json({ error: 'Failed to equip skill' });
        return;
      }

      res.status(201).json(equipped);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:agentId/skills/:skillId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId, skillId } = req.params;

      if (!agentId || !skillId) {
        res.status(400).json({ error: 'agentId and skillId are required' });
        return;
      }

      const deleted = await db
        .delete(agentSkills)
        .where(and(eq(agentSkills.botId, agentId), eq(agentSkills.skillId, skillId)))
        .returning();

      if (deleted.length === 0) {
        res.status(404).json({ error: 'Equipped skill not found' });
        return;
      }

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}