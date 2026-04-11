import type {
  PlanData,
  PlanVersion,
  Correlation,
  WorkoutSession,
  WeeklyReport,
  PlanSet,
} from '@vitals/shared';
import type { Candidate, ExerciseProgressSnapshot } from './progression-rules.js';
import {
  generateHoldCandidate,
  generateDoubleProgressionCandidate,
  generateTwoForTwoCandidate,
  generateDeloadCandidate,
  applyRpeGuardrail,
} from './progression-rules.js';
import { applyLoadCap, applyInjuryLock } from './safety-caps.js';

/**
 * All inputs consumed by the candidate generator.
 * Passed as a single value object so the signature stays stable as new
 * signals are added.
 */
export interface CandidateInput {
  /** The plan version the tuner is operating on. */
  planVersion: PlanVersion;
  /** Resolved PlanData from planVersion.data. */
  planData: PlanData;
  /** Recent workout sessions (last 4 weeks). */
  recentSessions: WorkoutSession[];
  /** The weekly report that triggered this tuning run. */
  report: WeeklyReport;
  /** Active PHIE correlations for the user. */
  correlations: Correlation[];
  /** User-supplied free-text notes (optional, used for injury detection). */
  userNotes?: string;
}

/**
 * Builds an ExerciseProgressSnapshot from the recent workout sessions for a
 * specific exercise name.
 */
function buildSnapshot(
  exerciseName: string,
  currentSets: PlanSet[],
  recentSessions: WorkoutSession[],
): ExerciseProgressSnapshot {
  const recentSets: ExerciseProgressSnapshot['recentSets'] = [];

  for (const session of recentSessions) {
    for (const set of session.sets) {
      if (
        set.exerciseName.toLowerCase() === exerciseName.toLowerCase() &&
        set.reps !== null &&
        set.weightKg !== null
      ) {
        recentSets.push({
          date: session.date,
          reps: set.reps,
          weightKg: set.weightKg,
          rpe: set.rpe !== null ? set.rpe : undefined,
        });
      }
    }
  }

  // Sort newest-first
  recentSets.sort((a, b) => b.date.localeCompare(a.date));

  return {
    exerciseName,
    recentSets,
    currentSets,
  };
}

/**
 * Extracts the hazard text from a weekly report for injury lock detection.
 */
function extractHazardText(report: WeeklyReport, userNotes?: string): string {
  const parts: string[] = [];
  if (report.sections?.hazards) parts.push(report.sections.hazards);
  if (userNotes) parts.push(userNotes);
  return parts.join(' ');
}

/**
 * Orchestrates all rule modules to produce a candidate set for every exercise
 * in the plan.
 *
 * For each exercise:
 *   1. Builds an ExerciseProgressSnapshot from recentSessions.
 *   2. Runs applicable progression-rule generators.
 *   3. Applies RPE guardrail.
 *   4. Applies safety caps (load cap, injury lock).
 *   5. Always includes a hold candidate as the safe fallback.
 *
 * The LLM then selects exactly one candidate per exercise from this map.
 *
 * @param input - All data needed to generate candidates.
 * @returns Map where key = `${dayIndex}:${exerciseOrder}` and value is the
 *          ordered list of candidates (hold always last as fallback).
 */
export function generateCandidates(input: CandidateInput): Map<string, Candidate[]> {
  const { planData, recentSessions, report, userNotes } = input;
  const result = new Map<string, Candidate[]>();
  const hazardText = extractHazardText(report, userNotes);

  for (let dayIndex = 0; dayIndex < planData.days.length; dayIndex++) {
    const day = planData.days[dayIndex];

    for (const exercise of day.exercises) {
      const key = `${dayIndex}:${exercise.orderInDay}`;
      const snapshot = buildSnapshot(exercise.exerciseName, exercise.sets, recentSessions);
      const hold = generateHoldCandidate(snapshot);
      const candidates: Candidate[] = [];

      // Generate progression candidates based on progressionRule
      if (exercise.progressionRule === 'double') {
        const doubleProg = generateDoubleProgressionCandidate(snapshot);
        if (doubleProg) {
          const currentWeight =
            exercise.sets.find((s) => s.targetWeightKg != null)?.targetWeightKg ?? 0;
          const capped = applyLoadCap(doubleProg, currentWeight);
          const guarded = applyRpeGuardrail(capped, snapshot);
          const locked = applyInjuryLock(exercise.primaryMuscle, hazardText, hold, guarded);
          candidates.push(locked);
        }
      } else if (exercise.progressionRule === 'linear') {
        const twoForTwo = generateTwoForTwoCandidate(snapshot);
        if (twoForTwo) {
          const currentWeight =
            exercise.sets.find((s) => s.targetWeightKg != null)?.targetWeightKg ?? 0;
          const capped = applyLoadCap(twoForTwo, currentWeight);
          const guarded = applyRpeGuardrail(capped, snapshot);
          const locked = applyInjuryLock(exercise.primaryMuscle, hazardText, hold, guarded);
          candidates.push(locked);
        }
      }

      // Deload is always offered
      const deload = generateDeloadCandidate(snapshot);
      candidates.push(deload);

      // Hold is always the last fallback
      candidates.push(hold);

      result.set(key, candidates);
    }
  }

  return result;
}
