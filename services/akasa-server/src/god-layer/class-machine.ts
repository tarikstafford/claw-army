/**
 * Agent Class State Machine
 *
 * Pure function — no DB I/O, no imports from @claw/db or ioredis.
 *
 * Computes class transitions (Novice -> Understudy -> Artisan, demotion,
 * retirement) based on the current agent class and council verdict type.
 *
 * This is a simplified version suitable for the akasa-server context
 * where the God Layer handler orchestrates state persistence.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentClass = 'Novice' | 'Understudy' | 'Artisan' | 'Retired';

export type VerdictType = 'Promote' | 'Maintain' | 'Monitor' | 'Demote' | 'Retire';

export interface ClassTransitionResult {
  newClass: AgentClass;
  transitioned: boolean;
}

// ---------------------------------------------------------------------------
// Class hierarchy order
// ---------------------------------------------------------------------------

const CLASS_ORDER: AgentClass[] = ['Novice', 'Understudy', 'Artisan'];

// ---------------------------------------------------------------------------
// Pure function
// ---------------------------------------------------------------------------

/**
 * Compute the next agent class based on current class and verdict type.
 *
 * Rules:
 * - Promote: advance one level (Novice->Understudy, Understudy->Artisan).
 *   If already Artisan, no transition.
 * - Demote: drop one level (Artisan->Understudy, Understudy->Novice).
 *   If already Novice, no transition.
 * - Retire: move to Retired from any class.
 * - Maintain / Monitor: no class change.
 */
export function computeClassTransition(
  currentClass: AgentClass,
  verdictType: VerdictType,
): ClassTransitionResult {
  // Retire: terminal state from any class
  if (verdictType === 'Retire') {
    if (currentClass === 'Retired') {
      return { newClass: 'Retired', transitioned: false };
    }
    return { newClass: 'Retired', transitioned: true };
  }

  // Promote: advance one level
  if (verdictType === 'Promote') {
    const currentIndex = CLASS_ORDER.indexOf(currentClass);
    if (currentIndex === -1) {
      // Retired or unknown — cannot promote
      return { newClass: currentClass, transitioned: false };
    }
    if (currentIndex >= CLASS_ORDER.length - 1) {
      // Already at Artisan (max) — no transition
      return { newClass: currentClass, transitioned: false };
    }
    const newClass = CLASS_ORDER[currentIndex + 1] as AgentClass;
    return { newClass, transitioned: true };
  }

  // Demote: drop one level
  if (verdictType === 'Demote') {
    const currentIndex = CLASS_ORDER.indexOf(currentClass);
    if (currentIndex === -1) {
      // Retired or unknown — cannot demote further
      return { newClass: currentClass, transitioned: false };
    }
    if (currentIndex <= 0) {
      // Already at Novice (min) — no transition
      return { newClass: currentClass, transitioned: false };
    }
    const newClass = CLASS_ORDER[currentIndex - 1] as AgentClass;
    return { newClass, transitioned: true };
  }

  // Maintain / Monitor: no class change
  return { newClass: currentClass, transitioned: false };
}
