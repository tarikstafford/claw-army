import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, bots, executions, councilVerdicts, paperclipAgents, issues } from '@claw/db';
import { eq, and, count, sql } from 'drizzle-orm';

const EXECUTION_SERVICE_URL = process.env.EXECUTION_SERVICE_URL ?? 'http://localhost:3001';

interface ExecuteCommandBody {
  command: string;
  args: string[];
  companyId: string;
}

interface CommandResult {
  ok: boolean;
  message: string;
  data?: Record<string, unknown>;
}

async function fetchFromExecutionService(path: string, options?: RequestInit): Promise<globalThis.Response> {
  const url = `${EXECUTION_SERVICE_URL}${path}`;
  const res = await fetch(url, options);
  return res;
}

async function handleStatus(_companyId: string): Promise<CommandResult> {
  const [activeBotCountRow] = await db
    .select({ count: count() })
    .from(bots)
    .where(sql`${bots.status} NOT IN ('stopped', 'failed')`);
  const activeBots = Number(activeBotCountRow?.count ?? 0);

  const [runningExecutionsRow] = await db
    .select({ count: count() })
    .from(executions)
    .where(eq(executions.status, 'running'));
  const runningExecutions = Number(runningExecutionsRow?.count ?? 0);

  const [pendingVerdictsRow] = await db
    .select({ count: count() })
    .from(councilVerdicts)
    .where(eq(councilVerdicts.status, 'pending'));
  const pendingVerdicts = Number(pendingVerdictsRow?.count ?? 0);

  return {
    ok: true,
    message: `Fleet status: ${activeBots} active bot${activeBots !== 1 ? 's' : ''}, ${runningExecutions} running execution${runningExecutions !== 1 ? 's' : ''}, ${pendingVerdicts} pending verdict${pendingVerdicts !== 1 ? 's' : ''}.`,
    data: {
      activeBots,
      runningExecutions,
      pendingVerdicts,
    },
  };
}

async function handlePause(companyId: string, agentName?: string): Promise<CommandResult> {
  if (!agentName || agentName === 'all') {
    const runningExecs = await db
      .select({ id: executions.id })
      .from(executions)
      .where(eq(executions.status, 'running'));

    if (runningExecs.length === 0) {
      return { ok: true, message: 'No running executions to pause.' };
    }

    for (const exec of runningExecs) {
      await db
        .update(executions)
        .set({ status: 'paused', updatedAt: new Date() })
        .where(eq(executions.id, exec.id));
    }

    return {
      ok: true,
      message: `Paused ${runningExecs.length} running execution${runningExecs.length !== 1 ? 's' : ''}.`,
    };
  }

  const agentRows = await db
    .select({ id: paperclipAgents.id })
    .from(paperclipAgents)
    .where(and(eq(paperclipAgents.companyId, companyId), eq(paperclipAgents.name, agentName)))
    .limit(1);

  const agent = agentRows[0];
  if (!agent) {
    return { ok: false, message: `Agent "${agentName}" not found.` };
  }

  const botRows = await db
    .select({ executionId: bots.executionId })
    .from(bots)
    .where(eq(bots.paperclipAgentId, agent.id))
    .limit(1);

  const bot = botRows[0];
  if (!bot) {
    return { ok: false, message: `No active execution found for agent "${agentName}".` };
  }

  const execRows = await db
    .select({ id: executions.id, status: executions.status })
    .from(executions)
    .where(eq(executions.id, bot.executionId))
    .limit(1);

  const exec = execRows[0];
  if (!exec) {
    return { ok: false, message: `Execution not found for agent "${agentName}".` };
  }

  if (exec.status === 'paused') {
    return { ok: true, message: `Agent "${agentName}" is already paused.` };
  }

  if (exec.status !== 'running') {
    return { ok: false, message: `Agent "${agentName}" is not running (status: ${exec.status}).` };
  }

  await db
    .update(executions)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(eq(executions.id, exec.id));

  return { ok: true, message: `Paused agent "${agentName}".` };
}

async function handleResume(companyId: string, agentName?: string): Promise<CommandResult> {
  if (!agentName || agentName === 'all') {
    const pausedExecs = await db
      .select({ id: executions.id })
      .from(executions)
      .where(eq(executions.status, 'paused'));

    if (pausedExecs.length === 0) {
      return { ok: true, message: 'No paused executions to resume.' };
    }

    for (const exec of pausedExecs) {
      await db
        .update(executions)
        .set({ status: 'running', updatedAt: new Date() })
        .where(eq(executions.id, exec.id));
    }

    return {
      ok: true,
      message: `Resumed ${pausedExecs.length} paused execution${pausedExecs.length !== 1 ? 's' : ''}.`,
    };
  }

  const agentRows = await db
    .select({ id: paperclipAgents.id })
    .from(paperclipAgents)
    .where(and(eq(paperclipAgents.companyId, companyId), eq(paperclipAgents.name, agentName)))
    .limit(1);

  const agent = agentRows[0];
  if (!agent) {
    return { ok: false, message: `Agent "${agentName}" not found.` };
  }

  const botRows = await db
    .select({ executionId: bots.executionId })
    .from(bots)
    .where(eq(bots.paperclipAgentId, agent.id))
    .limit(1);

  const bot = botRows[0];
  if (!bot) {
    return { ok: false, message: `No execution found for agent "${agentName}".` };
  }

  const execRows = await db
    .select({ id: executions.id, status: executions.status })
    .from(executions)
    .where(eq(executions.id, bot.executionId))
    .limit(1);

  const exec = execRows[0];
  if (!exec) {
    return { ok: false, message: `Execution not found for agent "${agentName}".` };
  }

  if (exec.status === 'running') {
    return { ok: true, message: `Agent "${agentName}" is already running.` };
  }

  if (exec.status !== 'paused') {
    return { ok: false, message: `Agent "${agentName}" cannot be resumed (status: ${exec.status}).` };
  }

  await db
    .update(executions)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(executions.id, exec.id));

  return { ok: true, message: `Resumed agent "${agentName}".` };
}

async function handleAssign(companyId: string, agentName: string, issueId: string): Promise<CommandResult> {
  if (!agentName || !issueId) {
    return { ok: false, message: 'Usage: /assign <agentName> <issueId>' };
  }

  const agentRows = await db
    .select({ id: paperclipAgents.id })
    .from(paperclipAgents)
    .where(and(eq(paperclipAgents.companyId, companyId), eq(paperclipAgents.name, agentName)))
    .limit(1);

  const agent = agentRows[0];
  if (!agent) {
    return { ok: false, message: `Agent "${agentName}" not found.` };
  }

  const issueRows = await db
    .select({ id: issues.id, assigneeAgentId: issues.assigneeAgentId })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);

  const issue = issueRows[0];
  if (!issue) {
    return { ok: false, message: `Issue "${issueId}" not found.` };
  }

  await db
    .update(issues)
    .set({ assigneeAgentId: agent.id, updatedAt: new Date() })
    .where(eq(issues.id, issueId));

  const wakeupRes = await fetchFromExecutionService(`/onboarding/wakeup/${agent.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!wakeupRes.ok) {
    console.warn('[commands] Issue assigned but wakeup failed:', wakeupRes.status);
  }

  return { ok: true, message: `Assigned issue ${issueId} to agent "${agentName}".` };
}

export function commandsRouter(): Router {
  const router = Router();

  router.post('/execute', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as ExecuteCommandBody;
      const { command, args = [], companyId } = body;

      if (!command || typeof command !== 'string') {
        res.status(400).json({ ok: false, message: 'command is required.' });
        return;
      }

      if (!companyId || typeof companyId !== 'string') {
        res.status(400).json({ ok: false, message: 'companyId is required.' });
        return;
      }

      let result: CommandResult;

      switch (command.toLowerCase()) {
        case 'status':
          result = await handleStatus(companyId);
          break;

        case 'pause':
          result = await handlePause(companyId, args[0]);
          break;

        case 'resume':
          result = await handleResume(companyId, args[0]);
          break;

        case 'assign':
          result = await handleAssign(companyId, args[0] ?? '', args[1] ?? '');
          break;

        default:
          result = {
            ok: false,
            message: `Unknown command: /${command}. Available: /status, /pause, /resume, /assign`,
          };
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
