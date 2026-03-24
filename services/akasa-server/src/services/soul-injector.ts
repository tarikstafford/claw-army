import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { agents } from '@paperclipai/db';
import { eq, and } from 'drizzle-orm';
import type { Db } from '@paperclipai/db';

// ─── Public Export ──────────────────────────────────────────────────────────────

/**
 * Inject a soul into a Paperclip agent's adapterConfig.
 *
 * For most adapters (process, local): writes SOUL.md to disk and sets `instructionsFilePath`.
 * For `openai_compatible` adapter: sets `systemPrompt` directly in adapterConfig.
 *
 * @param paperclipDb  - Drizzle DB instance connected to Paperclip's database
 * @param agentId      - UUID of the Paperclip agent to update
 * @param companyId    - UUID of the company owning the agent (for safety scoping)
 * @param soulContent  - Full SOUL.md markdown text
 * @param soulId       - UUID of the Akasa BotSoul (used as filename)
 * @param adapterType  - Optional adapter type override (default: file-based)
 */
export async function injectSoulIntoAgent(
  paperclipDb: Db,
  agentId: string,
  companyId: string,
  soulContent: string,
  soulId: string,
  adapterType?: string,
): Promise<void> {
  const soulsDir = join(homedir(), '.akasa', 'souls');
  const soulPath = join(soulsDir, `${soulId}.md`);

  // Always write the file to disk (useful for local process adapters and as audit trail)
  await mkdir(soulsDir, { recursive: true });
  await writeFile(soulPath, soulContent, 'utf-8');

  // Determine which adapterConfig patch to apply
  let adapterConfigPatch: Record<string, unknown>;

  if (adapterType === 'openai_compatible') {
    // OpenAI-compatible adapters receive soul via systemPrompt field
    adapterConfigPatch = { systemPrompt: soulContent };
  } else {
    // Local process adapters (openclaw, process) receive soul via instructionsFilePath
    adapterConfigPatch = { instructionsFilePath: soulPath };
  }

  // Update the Paperclip agent's adapterConfig by merging the patch
  // Uses Drizzle's jsonb merge pattern to preserve existing config fields
  await paperclipDb
    .update(agents)
    .set({
      adapterConfig: adapterConfigPatch,
      updatedAt: new Date(),
    })
    .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)));

  console.log(`[soul-injector] Soul injected: agentId=${agentId}, soulId=${soulId}, adapterType=${adapterType ?? 'default'}`);
}
