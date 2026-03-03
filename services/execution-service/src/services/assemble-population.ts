import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { db, ringLeaderRuns } from '@claw/db';
import { eq } from 'drizzle-orm';
import { searchSoulLibrary } from './soul-library-search';
import { selectFromPool, applyPreDeploymentMutation } from './population-assembler';
import type { SelectedSoul } from './population-assembler';
import { generatePioneerPopulation } from './pioneer-generator';
import { validateBudget } from './budget-validator';
import type { RingLeaderMissionBrief, PopulationManifest, TaskGraphNode } from '@claw/shared-types';

// ─── BudgetShortfallError ────────────────────────────────────────────────────

export class BudgetShortfallError extends Error {
  readonly shortfallCents: number;
  readonly minimumRequiredCents: number;
  readonly budgetCapCents: number;

  constructor(params: {
    shortfallCents: number;
    minimumRequiredCents: number;
    budgetCapCents: number;
  }) {
    super(
      `Budget cap of ${params.budgetCapCents}c cannot fund minimum populations ` +
      `(${params.minimumRequiredCents}c needed, shortfall: ${params.shortfallCents}c). ` +
      `Scope down tasks or increase budget.`,
    );
    this.name = 'BudgetShortfallError';
    this.shortfallCents = params.shortfallCents;
    this.minimumRequiredCents = params.minimumRequiredCents;
    this.budgetCapCents = params.budgetCapCents;
  }
}

// ─── Helper: Classify task category ────────────────────────────────────────────

async function classifyTaskCategory(taskDescription: string): Promise<string> {
  const { text } = await generateText({
    model: openai('gpt-4o-mini'),
    system: `Classify the following task description into a short, standardized category label (3-5 words, lowercase, hyphenated). Examples: "web-research-synthesis", "code-generation", "data-analysis", "content-creation". Return ONLY the category label, no other text.`,
    prompt: taskDescription,
    temperature: 0.1,
  });
  return text.trim().toLowerCase().replace(/\s+/g, '-');
}

// ─── Public Export: Top-level population assembly orchestrator ─────────────────

/**
 * Assemble a complete population manifest for all tasks in the Ring Leader's mission brief.
 *
 * For each task in the task graph, this function:
 *  1. Classifies the task into a category label
 *  2. Searches the soul library for matching souls (SOUL-01 through SOUL-03)
 *  3. If library returns insufficient results, uses pioneer path (SOUL-06)
 *  4. Otherwise uses pool selection with differentiation (SOUL-04)
 *  5. Optionally applies pre-deployment mutation for high-complexity tasks (SOUL-05)
 *  6. Assembles a PopulationManifest per task (SOUL-08)
 *
 * After assembly, persists PopulationManifest[] to ring_leader_runs.populationManifest
 * and transitions status from 'assembling' to 'spawning'.
 *
 * @param ringLeaderRunId - UUID of the ring_leader_runs row to update
 * @param missionBrief    - Full mission brief containing the task graph
 * @returns Array of PopulationManifest (one per task)
 */
export async function assemblePopulation(
  ringLeaderRunId: string,
  missionBrief: RingLeaderMissionBrief,
): Promise<PopulationManifest[]> {
  const { taskGraph, campaignType } = missionBrief;

  console.info(
    `[assemble-population] Starting population assembly for run=${ringLeaderRunId}, ` +
    `tasks=${taskGraph.tasks.length}`,
  );

  const manifests: PopulationManifest[] = [];

  for (const node of taskGraph.tasks) {
    console.info(
      `[assemble-population] Processing task=${node.taskId}: "${node.description.slice(0, 60)}..."`,
    );

    // ── Step 1: Classify task category ─────────────────────────────────────
    const taskCategory = await classifyTaskCategory(node.description);
    console.info(`[assemble-population] Task ${node.taskId}: category="${taskCategory}"`);

    // ── Step 2: Search soul library ─────────────────────────────────────────
    const searchResults = await searchSoulLibrary({
      taskDescription: node.description,
      taskCategory,
      requiredTools: node.requiredTools,
      taskComplexity: node.complexity,
      campaignType,
      requiredPopulation: node.recommendedPopulation,
    });

    console.info(
      `[assemble-population] Task ${node.taskId}: library returned ${searchResults.length} candidates ` +
      `(minPopulation=${node.minPopulation})`,
    );

    // ── Step 3: Determine path: pioneer or library ─────────────────────────
    const isPioneerPath = searchResults.length < node.minPopulation;
    let selectedSouls: SelectedSoul[];
    let varianceIntent: string | null = null;

    if (isPioneerPath) {
      // SOUL-06: Pioneer path — insufficient library results
      console.info(
        `[assemble-population] Task ${node.taskId}: pioneer path triggered ` +
        `(${searchResults.length} < ${node.minPopulation} minimum)`,
      );

      selectedSouls = await generatePioneerPopulation(
        node.description,
        taskCategory,
        node.requiredTools,
      );
    } else {
      // SOUL-04: Library path — select from pool with differentiation
      // Apply variance intent for multi-soul assignments (SOUL-07)
      if (node.recommendedPopulation > 1) {
        varianceIntent =
          `Multi-soul variance: ${node.recommendedPopulation} differentiated souls for ` +
          `'${node.description.slice(0, 80)}' to maximize behavioral coverage`;
      }

      selectedSouls = selectFromPool({
        pool: searchResults,
        requiredPopulation: node.recommendedPopulation,
        varianceIntent,
      });

      // Check if pool shortfall means we should have gone pioneer
      if (selectedSouls.length < node.minPopulation) {
        console.info(
          `[assemble-population] Task ${node.taskId}: pool shortfall after selection ` +
          `(${selectedSouls.length} < ${node.minPopulation}). Supplementing with pioneer generation.`,
        );

        const supplementCount = node.minPopulation - selectedSouls.length;
        const pioneers = await generatePioneerPopulation(
          node.description,
          taskCategory,
          node.requiredTools,
        );

        // Supplement with needed pioneers
        selectedSouls = [...selectedSouls, ...pioneers.slice(0, supplementCount)];
      }
    }

    // ── Step 5: Optional mutation pass for high-complexity tasks (SOUL-05) ──
    if (node.complexity === 'high' && selectedSouls.length >= 2) {
      console.info(
        `[assemble-population] Task ${node.taskId}: high complexity — applying amplification ` +
        `mutation to lowest-ranked soul`,
      );

      // Lowest ranked = last soul in array (sorted by class priority + finalRank from selectFromPool)
      const lowestRankedIndex = selectedSouls.length - 1;
      const lowestRanked = selectedSouls[lowestRankedIndex];

      if (lowestRanked !== undefined) {
        try {
          const mutationResult = await applyPreDeploymentMutation(
            lowestRanked,
            'amplification',
            `High-complexity task: amplifying lowest-ranked soul to increase specialist focus`,
          );

          // Update the soul in place with mutation results
          const mutatedSoul: SelectedSoul = {
            ...lowestRanked,
            soulContent: mutationResult.mutatedContent,
            embedding: mutationResult.mutatedEmbedding,
            mutationApplied: `${mutationResult.operation}: ${mutationResult.rationale}`,
          };

          selectedSouls = [
            ...selectedSouls.slice(0, lowestRankedIndex),
            mutatedSoul,
            ...selectedSouls.slice(lowestRankedIndex + 1),
          ];

          console.info(
            `[assemble-population] Task ${node.taskId}: mutation applied to soul ${lowestRanked.soulId}`,
          );
        } catch (mutationErr) {
          console.warn(
            `[assemble-population] Task ${node.taskId}: mutation failed (non-fatal):`,
            mutationErr,
          );
        }
      }
    }

    // ── Step 6: Build PopulationManifest for this task ─────────────────────
    const manifest: PopulationManifest = {
      taskId: node.taskId,
      taskDescription: node.description,
      assignedSouls: selectedSouls.map((s) => ({
        soulId: s.soulId,
        agentClass: s.agentClass,
        source: s.source,
        parentSoulId: s.parentSoulId,
        mutationApplied: s.mutationApplied,
        selectionRationale: s.selectionRationale,
        differentiationScore: s.differentiationScore,
      })),
      pioneerFlag: isPioneerPath,
      varianceIntent,
    };

    manifests.push(manifest);

    console.info(
      `[assemble-population] Task ${node.taskId}: manifest built ` +
      `(souls=${manifest.assignedSouls.length}, pioneer=${manifest.pioneerFlag})`,
    );
  }

  // ── Step 7: Budget validation gate (BUDG-01 through BUDG-04) ───────────────
  console.info(
    `[assemble-population] Validating budget for run=${ringLeaderRunId}, ` +
    `budgetCapCents=${missionBrief.budgetCapCents}`,
  );

  const budgetResult = validateBudget(manifests, missionBrief.budgetCapCents);

  if (!budgetResult.funded) {
    const { shortfallCents, minimumRequiredCents } = budgetResult;
    const { budgetCapCents } = missionBrief;

    console.warn(
      `[assemble-population] BUDGET SHORTFALL: estimated minimum cost ${minimumRequiredCents}c ` +
      `exceeds budget cap ${budgetCapCents}c (shortfall: ${shortfallCents}c)`,
    );

    // Persist failure details to ring_leader_runs.runState so API/UI consumers can surface them
    await db
      .update(ringLeaderRuns)
      .set({
        status: 'failed',
        runState: {
          budgetShortfall: true,
          shortfallCents,
          minimumRequiredCents,
          budgetCapCents,
          warnings: budgetResult.warnings,
        },
        updatedAt: new Date(),
      })
      .where(eq(ringLeaderRuns.id, ringLeaderRunId));

    throw new BudgetShortfallError({
      shortfallCents: shortfallCents!,
      minimumRequiredCents: minimumRequiredCents!,
      budgetCapCents,
    });
  }

  // Log any tiered-reduction warnings
  for (const warning of budgetResult.warnings) {
    console.warn(`[assemble-population] Budget warning for run=${ringLeaderRunId}: ${warning}`);
  }

  // Use the (possibly reduced) manifests from budget validation
  const finalManifests = budgetResult.manifests;

  // ── Step 8: Persist PopulationManifest[] to DB ─────────────────────────────
  console.info(
    `[assemble-population] Persisting ${finalManifests.length} manifests to ring_leader_runs row=${ringLeaderRunId}`,
  );

  const runStatePayload =
    budgetResult.warnings.length > 0
      ? { budgetWarnings: budgetResult.warnings }
      : undefined;

  await db
    .update(ringLeaderRuns)
    .set({
      populationManifest: finalManifests,
      status: 'spawning',
      ...(runStatePayload !== undefined ? { runState: runStatePayload } : {}),
      updatedAt: new Date(),
    })
    .where(eq(ringLeaderRuns.id, ringLeaderRunId));

  console.info(
    `[assemble-population] Population assembly complete for run=${ringLeaderRunId}: ` +
    `status transitioned assembling -> spawning`,
  );

  return finalManifests;
}
