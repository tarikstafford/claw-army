import { Router, type Request, type Response, type NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { db, skills } from '@claw/db';
import { eq, desc } from 'drizzle-orm';

interface SkillContent {
  name: string;
  description: string;
  version: string;
  category: string;
  triggers: string[];
  requires_tools: string[];
  requires_skills: string[];
  min_agent_class: string;
}

function parseFrontmatter(content: string): { metadata: SkillContent; errors: string[] } {
  const errors: string[] = [];
  const metadata: Partial<SkillContent> = {};

  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    errors.push('Missing YAML frontmatter (--- delimiters)');
    return { metadata: metadata as SkillContent, errors };
  }

  const frontmatter = frontmatterMatch[1]!;
  const lines = frontmatter.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    switch (key) {
      case 'name':
        metadata.name = value.replace(/^["']|["']$/g, '');
        break;
      case 'description':
        metadata.description = value.replace(/^["']|["']$/g, '');
        break;
      case 'version':
        metadata.version = value.replace(/^["']|["']$/g, '');
        break;
      case 'category':
        metadata.category = value.replace(/^["']|["']$/g, '');
        break;
      case 'triggers':
        try {
          metadata.triggers = JSON.parse(value);
        } catch {
          metadata.triggers = value.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
        }
        break;
      case 'requires_tools':
        try {
          metadata.requires_tools = JSON.parse(value);
        } catch {
          metadata.requires_tools = [];
        }
        break;
      case 'requires_skills':
        try {
          metadata.requires_skills = JSON.parse(value);
        } catch {
          metadata.requires_skills = [];
        }
        break;
      case 'min_agent_class':
        metadata.min_agent_class = value.replace(/^["']|["']$/g, '');
        break;
    }
  }

  const requiredFields = ['name', 'description', 'category'];
  for (const field of requiredFields) {
    if (!metadata[field as keyof SkillContent]) {
      errors.push(`Missing required frontmatter field: ${field}`);
    }
  }

  if (metadata.category && !['communication', 'analysis', 'creation', 'automation', 'research', 'coordination', 'monitoring', 'other'].includes(metadata.category)) {
    errors.push(`Invalid category: ${metadata.category}`);
  }

  if (metadata.min_agent_class && !['Novice', 'Understudy', 'Artisan'].includes(metadata.min_agent_class)) {
    errors.push(`Invalid min_agent_class: ${metadata.min_agent_class}`);
  }

  return { metadata: metadata as SkillContent, errors };
}

function validateProgressiveDisclosure(content: string): string[] {
  const errors: string[] = [];
  const sections = content.split(/\n(?=#+\s)/);

  if (sections.length < 2) {
    errors.push('Content must have at least metadata and body sections');
  }

  const hasMetadata = content.includes('---');
  const hasBody = sections.length >= 2;
  const referencesSection = sections[sections.length - 1]?.toLowerCase().includes('reference');

  if (!hasMetadata) {
    errors.push('Missing YAML frontmatter metadata section');
  }
  if (!hasBody) {
    errors.push('Missing body content section');
  }
  if (!referencesSection) {
    errors.push('Missing references section');
  }

  return errors;
}

function validateTriggers(triggers: string[]): string[] {
  const errors: string[] = [];

  for (const trigger of triggers) {
    try {
      new RegExp(trigger);
    } catch {
      if (trigger.includes('*')) {
        continue;
      }
      errors.push(`Invalid trigger pattern (not valid regex or glob): ${trigger}`);
    }
  }

  return errors;
}

function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

interface CreateSkillBody {
  userId: string;
  content: string;
  source?: 'user_created' | 'imported' | 'curated';
  isPublic?: boolean;
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

      const rows = await db.select().from(skills).where(eq(skills.userId, userId)).orderBy(desc(skills.createdAt));
      let filtered = rows;

      if (category) {
        filtered = filtered.filter((s) => s.category === category);
      }
      if (source) {
        filtered = filtered.filter((s) => s.source === source);
      }

      res.json(filtered);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateSkillBody;

      if (!body.userId || !body.content) {
        res.status(400).json({ error: 'userId and content are required' });
        return;
      }

      const allErrors: string[] = [];

      const { metadata, errors: parseErrors } = parseFrontmatter(body.content);
      allErrors.push(...parseErrors);

      const disclosureErrors = validateProgressiveDisclosure(body.content);
      allErrors.push(...disclosureErrors);

      if (metadata.triggers) {
        const triggerErrors = validateTriggers(metadata.triggers);
        allErrors.push(...triggerErrors);
      }

      if (allErrors.length > 0) {
        res.status(400).json({ errors: allErrors });
        return;
      }

      const contentHash = computeContentHash(body.content);

      const insert = {
        userId: body.userId,
        name: metadata.name!,
        description: metadata.description!,
        version: metadata.version || '1.0.0',
        category: metadata.category || 'other',
        triggers: metadata.triggers || [],
        requiresTools: metadata.requires_tools || [],
        requiresSkills: metadata.requires_skills || [],
        minAgentClass: metadata.min_agent_class || 'Novice',
        content: body.content,
        contentHash,
        source: body.source || 'user_created',
        isPublic: body.isPublic ? 'y' : 'n',
      };

      const rows = await db.insert(skills).values(insert).returning();
      const created = rows[0];
      if (!created) {
        res.status(500).json({ error: 'Failed to create skill' });
        return;
      }

      res.status(201).json(created);
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('UNIQUE')) {
        res.status(409).json({ error: 'Skill with this name already exists for this user' });
        return;
      }
      next(err);
    }
  });

  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const rows = await db.select().from(skills).where(eq(skills.id, id)).limit(1);

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
      const body = req.body as { content?: string; name?: string; description?: string };

      if (!body.content && !body.name && !body.description) {
        res.status(400).json({ error: 'At least one field (content, name, description) is required' });
        return;
      }

      const existingRows = await db.select().from(skills).where(eq(skills.id, id)).limit(1);
      const existing = existingRows[0];
      if (!existing) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      if (body.content) {
        const allErrors: string[] = [];

        const { metadata, errors: parseErrors } = parseFrontmatter(body.content);
        allErrors.push(...parseErrors);

        const disclosureErrors = validateProgressiveDisclosure(body.content);
        allErrors.push(...disclosureErrors);

        if (metadata.triggers) {
          const triggerErrors = validateTriggers(metadata.triggers);
          allErrors.push(...triggerErrors);
        }

        if (allErrors.length > 0) {
          res.status(400).json({ errors: allErrors });
          return;
        }

        const updatePayload = {
          content: body.content,
          contentHash: computeContentHash(body.content),
          name: metadata.name,
          description: metadata.description,
          version: metadata.version,
          category: metadata.category,
          triggers: metadata.triggers,
          requiresTools: metadata.requires_tools,
          requiresSkills: metadata.requires_skills,
          minAgentClass: metadata.min_agent_class,
          updatedAt: new Date(),
        };

        const rows = await db.update(skills).set(updatePayload).where(eq(skills.id, id)).returning();

        res.json(rows[0]);
      } else {
        const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
        if (body.name) updatePayload.name = body.name;
        if (body.description) updatePayload.description = body.description;

        const rows = await db.update(skills).set(updatePayload as typeof skills.$inferInsert).where(eq(skills.id, id)).returning();

        res.json(rows[0]);
      }
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const deleted = await db.delete(skills).where(eq(skills.id, id)).returning();

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
