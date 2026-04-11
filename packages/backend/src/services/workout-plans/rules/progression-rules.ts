import type { PlanEvidence, PlanSet } from '@vitals/shared';

/**
 * A candidate adjustment produced by a rule function.
 * The LLM selects from a set of candidates per exercise; it must not
 * invent values outside this set.
 */
export interface Candidate {
  changeType: string;
  newValue: unknown;
  rationale: string;
  confidence: 1 | 2 | 3 | 4 | 5;
  evidence?: PlanEvidence[];
}

/** Input snapshot for a single exercise used by the rule functions. */
export interface ExerciseProgressSnapshot {
  exerciseName: string;
  /** Last N sets from recent sessions, newest first. */
  recentSets: Array<{
    date: string;
    reps: number;
    weightKg: number;
    rpe?: number;
  }>;
  /** Current target sets from the active plan version. */
  currentSets: PlanSet[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the top target reps for a PlanSet (max of range or exact value). */
function topTargetReps(set: PlanSet): number {
  if (Array.isArray(set.targetReps)) return set.targetReps[1];
  return set.targetReps;
}

/** Returns the bottom target reps for a PlanSet (min of range or exact value). */
function bottomTargetReps(set: PlanSet): number {
  if (Array.isArray(set.targetReps)) return set.targetReps[0];
  return set.targetReps;
}

/**
 * Returns the max reps across the sets in a session (identified by date).
 * Only looks at "normal" sets.
 */
function maxRepsOnDate(snapshot: ExerciseProgressSnapshot, date: string): number | null {
  const sessionSets = snapshot.recentSets.filter((s) => s.date === date);
  if (sessionSets.length === 0) return null;
  return Math.max(...sessionSets.map((s) => s.reps));
}

/** Returns distinct dates from recentSets, sorted newest-first. */
function recentDates(snapshot: ExerciseProgressSnapshot): string[] {
  return [...new Set(snapshot.recentSets.map((s) => s.date))].sort().reverse();
}

// ---------------------------------------------------------------------------
// Candidate generators
// ---------------------------------------------------------------------------

/**
 * Generates a "hold" candidate — always emitted as the safe default.
 * The LLM can always fall back to hold if no other candidate is convincing.
 */
export function generateHoldCandidate(snapshot: ExerciseProgressSnapshot): Candidate {
  return {
    changeType: 'hold',
    newValue: snapshot.currentSets,
    rationale: 'Maintain current load and reps; no change needed this week.',
    confidence: 3,
  };
}

/**
 * Double-progression candidate: if reps have been at the top of the range
 * for the last 2+ sessions, propose a load increase; otherwise propose
 * a rep increment toward the top of the range.
 *
 * Applies to exercises with progressionRule === 'double'.
 */
export function generateDoubleProgressionCandidate(
  snapshot: ExerciseProgressSnapshot,
): Candidate | null {
  const normalSets = snapshot.currentSets.filter((s) => s.type !== 'warmup');
  if (normalSets.length === 0) return null;

  const referenceSet = normalSets[0];
  const top = topTargetReps(referenceSet);
  const bottom = bottomTargetReps(referenceSet);
  const currentWeight = referenceSet.targetWeightKg ?? 0;

  const dates = recentDates(snapshot);
  if (dates.length < 2) return null;

  const lastTwoAtTop = dates.slice(0, 2).every((date) => {
    const maxReps = maxRepsOnDate(snapshot, date);
    return maxReps !== null && maxReps >= top;
  });

  if (lastTwoAtTop) {
    // Load bump: upper body +2.5 kg, lower body +5 kg (use +2.5 as default)
    const increment = 2.5;
    const newWeight = currentWeight + increment;
    const newSets = normalSets.map((s) => ({
      ...s,
      targetWeightKg: newWeight,
      targetReps: [bottom, top] as [number, number],
    }));
    return {
      changeType: 'progress_load',
      newValue: newSets,
      rationale: `Reps at top of range (${top}) for 2 consecutive sessions — increase load by ${increment} kg.`,
      confidence: 4,
    };
  }

  // Check if current reps are below the top — suggest rep increase
  const lastDate = dates[0];
  const lastReps = maxRepsOnDate(snapshot, lastDate);
  if (lastReps !== null && lastReps < top) {
    const newTargetReps = Math.min(lastReps + 1, top);
    const newSets = normalSets.map((s) => ({
      ...s,
      targetReps: Array.isArray(s.targetReps)
        ? ([s.targetReps[0], newTargetReps] as [number, number])
        : newTargetReps,
    }));
    return {
      changeType: 'progress_reps',
      newValue: newSets,
      rationale: `Reps (${lastReps}) below range top (${top}) — push reps toward top.`,
      confidence: 3,
    };
  }

  return null;
}

/**
 * Two-for-two candidate: if the trainee completed the top of the rep range
 * in 2 or more consecutive sessions, propose adding weight next session.
 *
 * Applies to exercises with progressionRule === 'linear'.
 */
export function generateTwoForTwoCandidate(snapshot: ExerciseProgressSnapshot): Candidate | null {
  const normalSets = snapshot.currentSets.filter((s) => s.type !== 'warmup');
  if (normalSets.length === 0) return null;

  const referenceSet = normalSets[0];
  const top = topTargetReps(referenceSet);
  const bottom = bottomTargetReps(referenceSet);
  const currentWeight = referenceSet.targetWeightKg ?? 0;

  const dates = recentDates(snapshot);
  if (dates.length < 2) return null;

  const lastTwoAtTop = dates.slice(0, 2).every((date) => {
    const maxReps = maxRepsOnDate(snapshot, date);
    return maxReps !== null && maxReps >= top;
  });

  if (!lastTwoAtTop) return null;

  // Upper body: +2.5 kg, lower body: +5 kg
  // Use primary muscle heuristic to decide increment — default +2.5
  const increment = 2.5;
  const newWeight = currentWeight + increment;
  const newSets = normalSets.map((s) => ({
    ...s,
    targetWeightKg: newWeight,
    targetReps: [bottom, top] as [number, number],
  }));

  return {
    changeType: 'progress_load',
    newValue: newSets,
    rationale: `2-for-2: completed ${top} reps in last 2 sessions — increase load by ${increment} kg.`,
    confidence: 4,
  };
}

/**
 * Deload candidate: hard-coded deload formula.
 *   sets × 0.5 (rounded down, min 1)
 *   load × 0.9
 *   reps held at current target
 *
 * Always emitted alongside hold; LLM selects one or the other.
 */
export function generateDeloadCandidate(snapshot: ExerciseProgressSnapshot): Candidate {
  const normalSets = snapshot.currentSets.filter((s) => s.type !== 'warmup');
  const setCount = Math.max(1, Math.floor(normalSets.length * 0.5));
  const slicedSets = normalSets.slice(0, setCount);

  const deloadedSets = slicedSets.map((s) => ({
    ...s,
    targetWeightKg:
      s.targetWeightKg !== undefined ? Math.round(s.targetWeightKg * 0.9 * 2) / 2 : undefined,
    // reps held — targetReps unchanged
  }));

  return {
    changeType: 'deload',
    newValue: deloadedSets,
    rationale: `Deload: sets reduced to ${setCount} (×0.5), load reduced to 90%. Reps held.`,
    confidence: 3,
  };
}

/**
 * RPE guardrail: if the average top-set RPE over the last N sessions is ≥ 9,
 * blocks any load-increase candidate (returns the hold candidate instead).
 *
 * If RPE data is unavailable, this function is a no-op (returns input unchanged).
 *
 * @param candidate - The candidate to possibly override.
 * @param snapshot - Exercise progress including RPE data.
 * @returns Either the original candidate or a hold candidate.
 */
export function applyRpeGuardrail(
  candidate: Candidate,
  snapshot: ExerciseProgressSnapshot,
): Candidate {
  // Only block load-increase candidates
  if (candidate.changeType !== 'progress_load') return candidate;

  const rpeValues = snapshot.recentSets
    .filter((s) => s.rpe !== undefined && s.rpe !== null)
    .map((s) => s.rpe as number);

  if (rpeValues.length === 0) return candidate; // RPE data unavailable — no-op

  // Use last session's RPE values only (highest RPE per recent session)
  const dates = recentDates(snapshot);
  if (dates.length === 0) return candidate;

  const lastDate = dates[0];
  const lastSessionRpes = snapshot.recentSets
    .filter((s) => s.date === lastDate && s.rpe !== undefined)
    .map((s) => s.rpe as number);

  if (lastSessionRpes.length === 0) return candidate;

  const avgRpe = lastSessionRpes.reduce((a, b) => a + b, 0) / lastSessionRpes.length;

  if (avgRpe >= 9) {
    return {
      changeType: 'hold',
      newValue: snapshot.currentSets,
      rationale: `RPE guardrail: avg top-set RPE was ${avgRpe.toFixed(1)} (≥9) — hold load to avoid overtraining.`,
      confidence: 4,
    };
  }

  return candidate;
}
