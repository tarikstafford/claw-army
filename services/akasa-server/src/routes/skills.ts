import { Router } from 'express';
import { db, bots } from '@claw/db';
import { eq, and, sql } from 'drizzle-orm';

export function skillsRouter(): Router {
  const router = Router();

  router.get('/companies/:companyId/skills', async (req, res, next) => {
    try {
      const { companyId } = req.params;
      const { category, source, effectiveness, pendingApproval } = req.query;

      const conditions = [sql`TRUE`];
      if (category) conditions.push(sql`category = ${category}`);
      if (source) conditions.push(sql`source = ${source}`);
      if (effectiveness) conditions.push(sql`effectiveness_class = ${effectiveness}`);
      if (pendingApproval === 'true') conditions.push(sql`pending_approval = TRUE`);

      const rows = await db.execute(sql`
        SELECT id, company_id, name, category, source,
               trigger_patterns, effectiveness_score, effectiveness_class,
               content, confidence, pending_approval, created_at, updated_at
        FROM skills
        WHERE company_id = ${companyId}
        ORDER BY created_at DESC
      `);

      const skills = rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        companyId: r.company_id,
        name: r.name,
        category: r.category,
        source: r.source,
        triggerPatterns: r.trigger_patterns ?? [],
        effectivenessScore: r.effectiveness_score,
        effectivenessClass: r.effectiveness_class ?? 'unknown',
        content: r.content ?? '',
        confidence: r.confidence ?? 0,
        pendingApproval: r.pending_approval ?? false,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      res.json(skills);
    } catch (err) {
      next(err);
    }
  });

  router.get('/companies/:companyId/skills/pending', async (req, res, next) => {
    try {
      const { companyId } = req.params;
      const rows = await db.execute(sql`
        SELECT id, company_id, name, category, source,
               trigger_patterns, effectiveness_score, effectiveness_class,
               content, confidence, pending_approval, created_at, updated_at
        FROM skills
        WHERE company_id = ${companyId} AND pending_approval = TRUE
        ORDER BY created_at DESC
      `);

      const skills = rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        companyId: r.company_id,
        name: r.name,
        category: r.category,
        source: r.source,
        triggerPatterns: r.trigger_patterns ?? [],
        effectivenessScore: r.effectiveness_score,
        effectivenessClass: r.effectiveness_class ?? 'unknown',
        content: r.content ?? '',
        confidence: r.confidence ?? 0,
        pendingApproval: true,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));

      res.json(skills);
    } catch (err) {
      next(err);
    }
  });

  router.get('/companies/:companyId/skills/heatmap', async (req, res, next) => {
    try {
      const { companyId } = req.params;

      const agentRows = await db.execute(sql`
        SELECT DISTINCT b.id as bot_id, b.status
        FROM bots b
        WHERE b.execution_id IN (
          SELECT execution_id FROM bots WHERE execution_id IS NOT NULL
        )
      `);

      const skillRows = await db.execute(sql`
        SELECT id as skill_id, name FROM skills WHERE company_id = ${companyId}
      `);

      const effectivenessRows = await db.execute(sql`
        SELECT bot_id, skill_id, effectiveness_class
        FROM bot_skill_effectiveness
        WHERE company_id = ${companyId}
      `);

      const agents = agentRows.map((r: Record<string, unknown>) => ({
        botId: r.bot_id,
        name: String(r.bot_id).slice(0, 8),
      }));

      const skills = skillRows.map((r: Record<string, unknown>) => ({
        skillId: r.skill_id,
        name: r.name,
      }));

      const matrix: Record<string, Record<string, string>> = {};
      for (const row of effectivenessRows as Array<Record<string, unknown>>) {
        const botId = String(row.bot_id);
        const skillId = String(row.skill_id);
        if (!matrix[botId]) matrix[botId] = {};
        matrix[botId][skillId] = row.effectiveness_class ?? 'unknown';
      }

      res.json({ agents, skills, matrix });
    } catch (err) {
      next(err);
    }
  });

  router.post('/companies/:companyId/skills', async (req, res, next) => {
    try {
      const { companyId } = req.params;
      const { name, category, source, triggerPatterns, content } = req.body;

      if (!name || !category || !source) {
        res.status(400).json({ error: 'name, category, source are required' });
        return;
      }

      const rows = await db.execute(sql`
        INSERT INTO skills (id, company_id, name, category, source, trigger_patterns, content, confidence, pending_approval)
        VALUES (
          gen_random_uuid(),
          ${companyId},
          ${name},
          ${category},
          ${source},
          ${JSON.stringify(triggerPatterns ?? [])},
          ${content ?? ''},
          ${source === 'learned' ? 0.5 : 1.0},
          ${source === 'learned'}
        )
        RETURNING id, company_id, name, category, source, trigger_patterns,
                  effectiveness_score, effectiveness_class, content, confidence,
                  pending_approval, created_at, updated_at
      `);

      const r = rows[0] as Record<string, unknown>;
      res.status(201).json({
        id: r.id,
        companyId: r.company_id,
        name: r.name,
        category: r.category,
        source: r.source,
        triggerPatterns: r.trigger_patterns ?? [],
        effectivenessScore: r.effectiveness_score,
        effectivenessClass: r.effectiveness_class ?? 'unknown',
        content: r.content ?? '',
        confidence: r.confidence ?? 0,
        pendingApproval: r.pending_approval ?? false,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/skills/:skillId', async (req, res, next) => {
    try {
      const { skillId } = req.params;
      const { name, category, triggerPatterns, content } = req.body;

      const updates: string[] = [];
      const values: unknown[] = [];
      if (name !== undefined) { updates.push('name = ?'); values.push(name); }
      if (category !== undefined) { updates.push('category = ?'); values.push(category); }
      if (triggerPatterns !== undefined) { updates.push('trigger_patterns = ?'); values.push(JSON.stringify(triggerPatterns)); }
      if (content !== undefined) { updates.push('content = ?'); values.push(content); }
      updates.push('updated_at = NOW()');

      const rows = await db.execute(sql`
        UPDATE skills SET ${sql.raw(updates.join(', '))}
        WHERE id = ${skillId}
        RETURNING id, company_id, name, category, source, trigger_patterns,
                  effectiveness_score, effectiveness_class, content, confidence,
                  pending_approval, created_at, updated_at
      `);

      if (!rows.length) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      const r = rows[0] as Record<string, unknown>;
      res.json({
        id: r.id,
        companyId: r.company_id,
        name: r.name,
        category: r.category,
        source: r.source,
        triggerPatterns: r.trigger_patterns ?? [],
        effectivenessScore: r.effectiveness_score,
        effectivenessClass: r.effectiveness_class ?? 'unknown',
        content: r.content ?? '',
        confidence: r.confidence ?? 0,
        pendingApproval: r.pending_approval ?? false,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/skills/:skillId', async (req, res, next) => {
    try {
      const { skillId } = req.params;
      await db.execute(sql`DELETE FROM skills WHERE id = ${skillId}`);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post('/skills/:skillId/approve', async (req, res, next) => {
    try {
      const { skillId } = req.params;
      const rows = await db.execute(sql`
        UPDATE skills
        SET pending_approval = FALSE, confidence = 1.0, updated_at = NOW()
        WHERE id = ${skillId}
        RETURNING id, company_id, name, category, source, trigger_patterns,
                  effectiveness_score, effectiveness_class, content, confidence,
                  pending_approval, created_at, updated_at
      `);

      if (!rows.length) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      const r = rows[0] as Record<string, unknown>;
      res.json({
        id: r.id,
        companyId: r.company_id,
        name: r.name,
        category: r.category,
        source: r.source,
        triggerPatterns: r.trigger_patterns ?? [],
        effectivenessScore: r.effectiveness_score,
        effectivenessClass: r.effectiveness_class ?? 'unknown',
        content: r.content ?? '',
        confidence: r.confidence ?? 0,
        pendingApproval: false,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/evolution/bots/:botId/skills', async (req, res, next) => {
    try {
      const { botId } = req.params;

      const loadoutRows = await db.execute(sql`
        SELECT equipped_skill_ids, capacity
        FROM bot_skill_loadouts
        WHERE bot_id = ${botId}
        LIMIT 1
      `);

      if (!loadoutRows.length) {
        res.json({ botId, equippedSkillIds: [], capacity: 5 });
        return;
      }

      const r = loadoutRows[0] as Record<string, unknown>;
      res.json({
        botId,
        equippedSkillIds: (r.equipped_skill_ids as string[]) ?? [],
        capacity: r.capacity ?? 5,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/evolution/bots/:botId/skills/:skillId/equip', async (req, res, next) => {
    try {
      const { botId, skillId } = req.params;

      const existing = await db.execute(sql`
        SELECT equipped_skill_ids, capacity FROM bot_skill_loadouts WHERE bot_id = ${botId} LIMIT 1
      `);

      let equippedSkillIds: string[] = [];
      let capacity = 5;

      if (existing.length) {
        const r = existing[0] as Record<string, unknown>;
        equippedSkillIds = (r.equipped_skill_ids as string[]) ?? [];
        capacity = r.capacity ?? 5;
      }

      if (equippedSkillIds.includes(skillId)) {
        res.json({ botId, equippedSkillIds, capacity });
        return;
      }

      if (equippedSkillIds.length >= capacity) {
        equippedSkillIds = equippedSkillIds.slice(1);
      }

      equippedSkillIds.push(skillId);

      await db.execute(sql`
        INSERT INTO bot_skill_loadouts (bot_id, equipped_skill_ids, capacity)
        VALUES (${botId}, ${JSON.stringify(equippedSkillIds)}, ${capacity})
        ON CONFLICT (bot_id) DO UPDATE SET equipped_skill_ids = ${JSON.stringify(equippedSkillIds)}
      `);

      res.json({ botId, equippedSkillIds, capacity });
    } catch (err) {
      next(err);
    }
  });

  router.post('/evolution/bots/:botId/skills/:skillId/unequip', async (req, res, next) => {
    try {
      const { botId, skillId } = req.params;

      const existing = await db.execute(sql`
        SELECT equipped_skill_ids, capacity FROM bot_skill_loadouts WHERE bot_id = ${botId} LIMIT 1
      `);

      if (!existing.length) {
        res.json({ botId, equippedSkillIds: [], capacity: 5 });
        return;
      }

      const r = existing[0] as Record<string, unknown>;
      let equippedSkillIds = (r.equipped_skill_ids as string[]) ?? [];
      const capacity = r.capacity ?? 5;

      equippedSkillIds = equippedSkillIds.filter(id => id !== skillId);

      await db.execute(sql`
        UPDATE bot_skill_loadouts SET equipped_skill_ids = ${JSON.stringify(equippedSkillIds)}
        WHERE bot_id = ${botId}
      `);

      res.json({ botId, equippedSkillIds, capacity });
    } catch (err) {
      next(err);
    }
  });

  router.put('/evolution/bots/:botId/skills/reorder', async (req, res, next) => {
    try {
      const { botId } = req.params;
      const { orderedSkillIds } = req.body;

      if (!Array.isArray(orderedSkillIds)) {
        res.status(400).json({ error: 'orderedSkillIds must be an array' });
        return;
      }

      const existing = await db.execute(sql`
        SELECT capacity FROM bot_skill_loadouts WHERE bot_id = ${botId} LIMIT 1
      `);

      const capacity = existing.length ? (existing[0] as Record<string, unknown>).capacity ?? 5 : 5;

      await db.execute(sql`
        INSERT INTO bot_skill_loadouts (bot_id, equipped_skill_ids, capacity)
        VALUES (${botId}, ${JSON.stringify(orderedSkillIds)}, ${capacity})
        ON CONFLICT (bot_id) DO UPDATE SET equipped_skill_ids = ${JSON.stringify(orderedSkillIds)}
      `);

      res.json({ botId, equippedSkillIds: orderedSkillIds, capacity });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
