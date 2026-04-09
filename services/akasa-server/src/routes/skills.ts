import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, skills, agentSkills, bots, agentClasses } from '@claw/db';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { createHash } from 'node:crypto';

const AGENT_CLASS_CAPACITY: Record<string, number> = {
  Novice: 3,
  Understudy: 5,
  Artisan: 8,
};

const SKILL_CATEGORIES = ['communication', 'reasoning', 'tool_use', 'domain_knowledge', 'meta'] as const;
const SKILL_SOURCES = ['user_created', 'dna_captured', 'archetype'] as const;
const AGENT_CLASSES = ['Novice', 'Understudy', 'Artisan'] as const;

const createSkillSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  version: z.string().default('1.0.0'),
  category: z.enum(SKILL_CATEGORIES),
  triggers: z.array(z.string()).default([]),
  requiresTools: z.array(z.string()).default([]),
  requiresSkills: z.array(z.string()).default([]),
  minAgentClass: z.enum(AGENT_CLASSES).default('Novice'),
  content: z.string().min(1),
  source: z.enum(SKILL_SOURCES).default('user_created'),
});

const updateSkillSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().min(1).optional(),
  version: z.string().optional(),
  category: z.enum(SKILL_CATEGORIES).optional(),
  triggers: z.array(z.string()).optional(),
  requiresTools: z.array(z.string()).optional(),
  requiresSkills: z.array(z.string()).optional(),
  minAgentClass: z.enum(AGENT_CLASSES).optional(),
  content: z.string().min(1).optional(),
});

interface SkillValidationResult {
  valid: boolean;
  errors: string[];
  parsedFrontmatter?: {
    name: string;
    description: string;
    version: string;
    category: string;
    triggers: string[];
    requires_tools: string[];
    requires_skills: string[];
    min_agent_class: string;
  };
}

function validateSkillMarkdown(content: string): SkillValidationResult {
  const errors: string[] = [];

  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    errors.push('Missing YAML frontmatter (---...---)');
    return { valid: false, errors };
  }

  const yamlContent = frontmatterMatch[1]!;
  const frontmatter: Record<string, unknown> = {};

  for (const line of yamlContent.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      frontmatter[key] = value
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if (value === 'true' || value === 'false') {
      frontmatter[key] = value === 'true';
    } else {
      frontmatter[key] = value.replace(/^["']|["']$/g, '');
    }
  }

  const requiredFields = ['name', 'description', 'category'];
  for (const field of requiredFields) {
    if (!frontmatter[field]) {
      errors.push(`Missing required frontmatter field: ${field}`);
    }
  }

  if (frontmatter.category && !SKILL_CATEGORIES.includes(frontmatter.category as (typeof SKILL_CATEGORIES)[number])) {
    errors.push(`Invalid category: ${frontmatter.category}. Must be one of: ${SKILL_CATEGORIES.join(', ')}`);
  }

  if (frontmatter.min_agent_class && !AGENT_CLASSES.includes(frontmatter.min_agent_class as (typeof AGENT_CLASSES)[number])) {
    errors.push(`Invalid min_agent_class: ${frontmatter.min_agent_class}. Must be one of: ${AGENT_CLASSES.join(', ')}`);
  }

  const sections = content.split(/\n(?=#+\s)/);
  if (sections.length < 3) {
    errors.push('Missing progressive disclosure sections (expected metadata, body, references)');
  }

  const triggerPatterns = (frontmatter.triggers as string[]) || [];
  for (const pattern of triggerPatterns) {
    try {
      new RegExp(pattern);
    } catch {
      if (!pattern.includes('*') && !pattern.includes('?')) {
        errors.push(`Invalid trigger pattern (not regex or glob): ${pattern}`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    parsedFrontmatter: {
      name: frontmatter.name as string,
      description: frontmatter.description as string,
      version: (frontmatter.version as string) || '1.0.0',
      category: frontmatter.category as string,
      triggers: (frontmatter.triggers as string[]) || [],
      requires_tools: (frontmatter.requires_tools as string[]) || [],
      requires_skills: (frontmatter.requires_skills as string[]) || [],
      min_agent_class: (frontmatter.min_agent_class as string) || 'Novice',
    },
  };
}

function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function getAgentClassForBot(botId: string): Promise<string> {
  const rows = await db
    .select()
    .from(agentClasses)
    .where(eq(agentClasses.botId, botId))
    .limit(1);

  return rows[0]?.currentClass ?? 'Novice';
}

async function getEquippedSkillCount(botId: string): Promise<number> {
  const rows = await db
    .select()
    .from(agentSkills)
    .where(eq(agentSkills.botId, botId));
  return rows.length;
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
      if (category) {
        conditions.push(eq(skills.category, category) as ReturnType<typeof eq>);
      }
      if (source) {
        conditions.push(eq(skills.source, source) as ReturnType<typeof eq>);
      }

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
      const userId = req.query['userId'] as string;
      if (!userId) {
        res.status(400).json({ error: 'userId query parameter is required' });
        return;
      }

      const body = req.body;
      const content = body.content as string;

      const validation = validateSkillMarkdown(content);
      if (!validation.valid) {
        res.status(400).json({ error: 'Invalid skill format', details: validation.errors });
        return;
      }

      const fm = validation.parsedFrontmatter!;
      const contentHash = computeContentHash(content);

      const insert = {
        userId,
        name: fm.name,
        description: fm.description,
        version: fm.version,
        category: fm.category,
        triggers: fm.triggers,
        requiresTools: fm.requires_tools,
        requiresSkills: fm.requires_skills,
        minAgentClass: fm.min_agent_class,
        content,
        contentHash,
        source: body.source || 'user_created',
      };

      try {
        const rows = await db.insert(skills).values(insert).returning();
        const created = rows[0];
        if (!created) {
          res.status(500).json({ error: 'Failed to create skill' });
          return;
        }
        res.status(201).json(created);
      } catch (insertErr) {
        const msg = (insertErr as Error).message ?? '';
        if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('UNIQUE')) {
          res.status(409).json({ error: `Skill "${fm.name}" already exists for this user` });
          return;
        }
        throw insertErr;
      }
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

      const skill = rows[0];
      if (!skill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      res.json(skill);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Skill ID is required' });
        return;
      }

      const body = req.body;
      const content = body.content as string | undefined;

      if (content) {
        const validation = validateSkillMarkdown(content);
        if (!validation.valid) {
          res.status(400).json({ error: 'Invalid skill format', details: validation.errors });
          return;
        }
        body.contentHash = computeContentHash(content);
        const fm = validation.parsedFrontmatter!;
        body.name = fm.name;
        body.description = fm.description;
        body.version = fm.version;
        body.category = fm.category;
        body.triggers = fm.triggers;
        body.requiresTools = fm.requires_tools;
        body.requiresSkills = fm.requires_skills;
        body.minAgentClass = fm.min_agent_class;
      }

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      const allowedFields = [
        'name',
        'description',
        'version',
        'category',
        'triggers',
        'requiresTools',
        'requiresSkills',
        'minAgentClass',
        'content',
        'contentHash',
      ];

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      const updated = await db
        .update(skills)
        .set(updateData as typeof skills.$inferInsert)
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
  const router = Router({ mergeParams: true });

  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      if (!agentId) {
        res.status(400).json({ error: 'Agent ID is required' });
        return;
      }

      const equipped = await db
        .select({
          skill: skills,
          agentSkill: agentSkills,
        })
        .from(agentSkills)
        .innerJoin(skills, eq(agentSkills.skillId, skills.id))
        .where(eq(agentSkills.botId, agentId))
        .orderBy(desc(agentSkills.equippedAt));

      const result = equipped.map((row) => ({
        ...row.skill,
        equippedAt: row.agentSkill.equippedAt,
        equippedBy: row.agentSkill.equippedBy,
      }));

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:skillId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      const { skillId } = req.params;
      const equippedBy = req.query['userId'] as string;

      if (!agentId || !skillId) {
        res.status(400).json({ error: 'Agent ID and Skill ID are required' });
        return;
      }

      if (!equippedBy) {
        res.status(400).json({ error: 'userId query parameter is required' });
        return;
      }

      const skillRows = await db
        .select()
        .from(skills)
        .where(eq(skills.id, skillId))
        .limit(1);

      const skill = skillRows[0];
      if (!skill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      const botRows = await db
        .select()
        .from(bots)
        .where(eq(bots.id, agentId))
        .limit(1);

      const bot = botRows[0];
      if (!bot) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      const agentClass = await getAgentClassForBot(agentId);
      const capacity = AGENT_CLASS_CAPACITY[agentClass] ?? 3;
      const currentCount = await getEquippedSkillCount(agentId);

      if (currentCount >= capacity) {
        res.status(400).json({
          error: `Capacity exceeded for ${agentClass} class. Maximum: ${capacity}, Current: ${currentCount}`,
        });
        return;
      }

      try {
        const rows = await db
          .insert(agentSkills)
          .values({
            botId: agentId,
            skillId,
            equippedBy,
          })
          .returning();

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

  router.delete('/:skillId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId, skillId } = req.params;
      if (!agentId || !skillId) {
        res.status(400).json({ error: 'Agent ID and Skill ID are required' });
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