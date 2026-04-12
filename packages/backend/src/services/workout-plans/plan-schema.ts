import type { PlanData, PlanDay, PlanExercise, PlanSet } from '@vitals/shared';

function isValidSetType(v: unknown): boolean {
  return v === 'warmup' || v === 'normal' || v === 'drop' || v === 'failure' || v === 'amrap';
}

function isValidTargetReps(v: unknown): boolean {
  if (typeof v === 'number') return v > 0;
  if (Array.isArray(v) && v.length === 2) {
    return typeof v[0] === 'number' && typeof v[1] === 'number' && v[0] > 0 && v[1] >= v[0];
  }
  return false;
}

function isValidPlanSet(v: unknown): v is PlanSet {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return isValidSetType(s['type']) && isValidTargetReps(s['targetReps']);
}

function isValidProgressionRule(v: unknown): boolean {
  return v === 'double' || v === 'linear' || v === 'rpe_stop' || v === 'manual';
}

function isValidSfrTier(v: unknown): boolean {
  return v === 'S' || v === 'A' || v === 'B' || v === 'C';
}

function isValidPlanExercise(v: unknown): v is PlanExercise {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  if (typeof e['id'] !== 'string') return false;
  if (typeof e['exerciseName'] !== 'string') return false;
  if (typeof e['orderInDay'] !== 'number') return false;
  if (!Array.isArray(e['sets'])) return false;
  if (!e['sets'].every(isValidPlanSet)) return false;
  if (!isValidProgressionRule(e['progressionRule'])) return false;
  if (typeof e['primaryMuscle'] !== 'string') return false;
  if (!Array.isArray(e['secondaryMuscles'])) return false;
  if (typeof e['pattern'] !== 'string') return false;
  if (typeof e['equipment'] !== 'string') return false;
  if (!isValidSfrTier(e['sfrTier'])) return false;
  return true;
}

function isValidPlanDay(v: unknown): v is PlanDay {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  if (typeof d['name'] !== 'string') return false;
  if (!Array.isArray(d['targetMuscles'])) return false;
  if (!Array.isArray(d['exercises'])) return false;
  if (!d['exercises'].every(isValidPlanExercise)) return false;
  return true;
}

const VALID_PROGRESSION_PERSONALITIES = ['conservative', 'balanced', 'aggressive'] as const;

function isValidProgressionPersonality(v: unknown): boolean {
  return VALID_PROGRESSION_PERSONALITIES.includes(
    v as (typeof VALID_PROGRESSION_PERSONALITIES)[number],
  );
}

/**
 * Type guard: returns true if the value is a valid PlanData shape.
 * Used to validate JSONB round-trips and AI-parsed plan structures.
 */
export function isPlanData(value: unknown): value is PlanData {
  if (typeof value !== 'object' || value === null) return false;
  const d = value as Record<string, unknown>;
  if (typeof d['splitType'] !== 'string') return false;
  // progressionPersonality is optional; if present must be a valid value
  if (
    d['progressionPersonality'] !== undefined &&
    !isValidProgressionPersonality(d['progressionPersonality'])
  )
    return false;
  if (!Array.isArray(d['days'])) return false;
  if (!d['days'].every(isValidPlanDay)) return false;
  return true;
}

/**
 * Validates that an unknown value conforms to PlanData.
 * Throws a descriptive error if validation fails.
 * Used after JSON.parse on stored JSONB or AI output.
 *
 * progressionPersonality accepts 'conservative' | 'balanced' | 'aggressive'.
 * Missing value defaults to 'balanced'.
 */
export function validatePlanData(data: unknown): PlanData {
  if (typeof data !== 'object' || data === null) {
    throw new Error('invalid plan data: expected an object');
  }
  const d = data as Record<string, unknown>;

  if (typeof d['splitType'] !== 'string') {
    throw new Error('invalid plan data: splitType must be a string');
  }

  // Default missing progressionPersonality to 'balanced'
  if (d['progressionPersonality'] === undefined || d['progressionPersonality'] === null) {
    d['progressionPersonality'] = 'balanced';
  } else if (!isValidProgressionPersonality(d['progressionPersonality'])) {
    throw new Error(
      `invalid plan data: progressionPersonality must be "conservative", "balanced", or "aggressive", got ${String(d['progressionPersonality'])}`,
    );
  }

  if (!Array.isArray(d['days'])) {
    throw new Error('invalid plan data: days must be an array');
  }

  for (let i = 0; i < d['days'].length; i++) {
    const day = d['days'][i] as unknown;
    if (!isValidPlanDay(day)) {
      throw new Error(`invalid plan data: day at index ${i} has invalid shape`);
    }
  }

  return data as PlanData;
}
