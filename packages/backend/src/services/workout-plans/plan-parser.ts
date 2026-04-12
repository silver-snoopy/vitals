import type {
  PlanData,
  PlanDay,
  PlanExercise,
  PlanSet,
  ProgressionRule,
  SfrTier,
} from '@vitals/shared';
import { getExerciseMeta } from './exercise-metadata.js';

/**
 * Infer progressionRule from SFR tier.
 * S-tier compounds (bench, squat, deadlift) → 'linear' (2-for-2 rule).
 * A/B/C-tier accessories/isolation → 'double' (double-progression).
 */
function inferProgressionRule(sfrTier: SfrTier): ProgressionRule {
  return sfrTier === 'S' ? 'linear' : 'double';
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/**
 * Matches day header lines — e.g. "Day 1:", "Monday:", "Push A:", "# Pull", "D1 — UPPER"
 * A day header must NOT look like an exercise line (no set×rep pattern).
 */
const DAY_HEADER_RE =
  /^(?:#{1,3}\s*)?(?:d\d+\b|day\s*\d+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|push|pull|legs|upper|lower|full body|chest|back|arms|shoulders|core)\b/i;

/** Matches set×rep patterns — e.g. "3x8", "3×8-12", "4×5", "3 x 10" */
const SET_REP_RE = /(\d+)\s*[x×]\s*(\d+)(?:\s*[–-]\s*(\d+))?/i;

/** Matches weight annotation — e.g. "@ 70kg", "@70 kg", "70kg", "70lbs" */
const WEIGHT_RE = /@?\s*([\d.]+)\s*(?:kg|lbs?)/i;

/** Matches RPE/RIR annotation — e.g. "@RPE 8", "RPE8", "@8", "@ 8 RPE", "@1 RIR", "@1–2 RIR" */
const RPE_RE = /@\s*(?:(?:rpe|rir)\s*)?(\d(?:\.\d)?)\s*(?:rpe|rir)?(?!\s*k?g)/i;

/** Matches a leading bullet or dash */
const BULLET_RE = /^[-*•]\s*/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDayHeader(line: string): boolean {
  const trimmed = line.trim();
  // A line that contains a set×rep pattern is an exercise, not a day header
  if (SET_REP_RE.test(trimmed)) return false;
  return DAY_HEADER_RE.test(trimmed);
}

function isExerciseLine(line: string): boolean {
  const stripped = line.replace(BULLET_RE, '').trim();
  if (stripped.length < 3) return false;
  // Must contain a set×rep pattern to be considered an exercise line
  return SET_REP_RE.test(stripped);
}

function parseExerciseLine(line: string, order: number): PlanExercise | null {
  const stripped = line.replace(BULLET_RE, '').trim();
  const setRepMatch = SET_REP_RE.exec(stripped);
  if (!setRepMatch) return null;

  const setCount = parseInt(setRepMatch[1], 10);
  const repLow = parseInt(setRepMatch[2], 10);
  const repHigh = setRepMatch[3] ? parseInt(setRepMatch[3], 10) : null;
  const targetReps: PlanSet['targetReps'] = repHigh !== null ? [repLow, repHigh] : repLow;

  // Extract weight
  let targetWeightKg: number | undefined;
  const weightMatch = WEIGHT_RE.exec(stripped);
  if (weightMatch) {
    const raw = parseFloat(weightMatch[1]);
    const unit = weightMatch[0].toLowerCase();
    targetWeightKg = unit.includes('lb') ? raw * 0.453592 : raw;
  }

  // Extract RPE
  let targetRpe: number | undefined;
  const rpeMatch = RPE_RE.exec(stripped);
  if (rpeMatch) {
    targetRpe = parseFloat(rpeMatch[1]);
  }

  // Extract exercise name: everything before the set×rep pattern
  const nameRaw = stripped.substring(0, stripped.search(SET_REP_RE)).trim();
  // Remove trailing punctuation and em dashes (common separator: "Bench Press — 3×8")
  const exerciseName = nameRaw.replace(/[,.:\u2014\u2013-]+$/, '').trim() || 'Exercise';

  const meta = getExerciseMeta(exerciseName);

  const sets: PlanSet[] = Array.from({ length: setCount }, () => {
    const s: PlanSet = { type: 'normal', targetReps };
    if (targetWeightKg !== undefined) s.targetWeightKg = targetWeightKg;
    if (targetRpe !== undefined) s.targetRpe = targetRpe;
    return s;
  });

  return {
    id: `ex-${order}`,
    exerciseName,
    orderInDay: order,
    sets,
    progressionRule: inferProgressionRule(meta.sfrTier),
    primaryMuscle: meta.primaryMuscle,
    secondaryMuscles: meta.secondaryMuscles,
    pattern: meta.pattern,
    equipment: meta.equipment,
    sfrTier: meta.sfrTier,
  };
}

function cleanHeaderText(line: string): string {
  return line
    .replace(/^#{1,3}\s*/, '')
    .replace(/[:：\s]+$/, '')
    .trim();
}

function inferTargetMuscles(dayName: string): string[] {
  const lower = dayName.toLowerCase();
  if (lower.includes('push')) return ['chest', 'front deltoid', 'triceps'];
  if (lower.includes('pull')) return ['upper back', 'lats', 'biceps'];
  if (lower.includes('leg')) return ['quads', 'hamstrings', 'glutes'];
  if (lower.includes('upper')) return ['chest', 'back', 'shoulders'];
  if (lower.includes('lower')) return ['quads', 'hamstrings', 'glutes'];
  if (lower.includes('chest')) return ['chest'];
  if (lower.includes('back')) return ['upper back', 'lats'];
  if (lower.includes('shoulder')) return ['front deltoid', 'lateral deltoid'];
  if (lower.includes('arm')) return ['biceps', 'triceps'];
  if (lower.includes('full body')) return ['full body'];
  return [];
}

/**
 * Parses a free-text workout plan (e.g. pasted from a note or doc) into a
 * structured PlanData shape.
 *
 * Strategy:
 *  1. Heuristic regex scan for day headers (e.g. "Monday:", "Push A:", "Day 1:").
 *  2. Within each day block, scan for exercise lines (name + sets × reps).
 *  3. Map known exercise names to metadata via EXERCISE_METADATA.
 *  4. Fallback: if structure can't be detected, return a single "Notes" day with
 *     the raw text stored in day.exercises[0].notes and a placeholder exercise.
 *
 * @param rawText - User-pasted plan text (may be arbitrarily formatted).
 * @returns A best-effort PlanData. Never throws — falls back to the single-day
 *          notes wrapper so the caller always gets a valid (if minimal) plan.
 */
export function parseFreeTextPlan(rawText: string): PlanData {
  if (!rawText || rawText.trim().length === 0) {
    return buildFallback(rawText);
  }

  const lines = rawText.split(/\r?\n/);

  // Pass 1: detect day headers and their positions
  const dayBoundaries: Array<{ index: number; name: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isDayHeader(line)) {
      dayBoundaries.push({ index: i, name: cleanHeaderText(line) });
    }
  }

  if (dayBoundaries.length === 0) {
    // No day structure detected — fallback
    return buildFallback(rawText);
  }

  // Pass 2: for each day block, collect exercise lines
  const days: PlanDay[] = [];
  for (let d = 0; d < dayBoundaries.length; d++) {
    const start = dayBoundaries[d].index + 1;
    const end = d + 1 < dayBoundaries.length ? dayBoundaries[d + 1].index : lines.length;
    const dayName = dayBoundaries[d].name;

    const exercises: PlanExercise[] = [];
    let order = 1;
    for (let i = start; i < end; i++) {
      const line = lines[i];
      if (isExerciseLine(line)) {
        const ex = parseExerciseLine(line, order);
        if (ex) {
          exercises.push(ex);
          order++;
        }
      }
    }

    // Infer split type from day name
    const targetMuscles =
      exercises.length > 0
        ? [...new Set(exercises.map((e) => e.primaryMuscle))]
        : inferTargetMuscles(dayName);

    days.push({
      name: dayName,
      targetMuscles,
      exercises,
    });
  }

  // Infer split type from day names
  const dayNames = days.map((d) => d.name.toLowerCase());
  let splitType = 'Custom';
  if (dayNames.some((n) => n.includes('push')) && dayNames.some((n) => n.includes('pull'))) {
    splitType = 'PPL';
  } else if (
    dayNames.some((n) => n.includes('upper')) &&
    dayNames.some((n) => n.includes('lower'))
  ) {
    splitType = 'UL';
  } else if (dayNames.some((n) => n.includes('full body'))) {
    splitType = 'FB';
  } else if (days.length === 1) {
    splitType = 'Custom';
  }

  return {
    splitType,
    progressionPersonality: 'balanced',
    days,
  };
}

/** Fallback plan: single "Notes" day with raw text stored in exercises[0].notes. */
function buildFallback(rawText: string): PlanData {
  // NOTE: user health data — truncate to prevent unbounded growth in stored JSONB
  const FALLBACK_NOTES_MAX = 10_000;
  const truncatedNotes =
    rawText && rawText.length > FALLBACK_NOTES_MAX ? rawText.slice(0, FALLBACK_NOTES_MAX) : rawText;

  return {
    splitType: 'Custom',
    progressionPersonality: 'balanced',
    days: [
      {
        name: 'My Plan',
        targetMuscles: [],
        exercises: [
          {
            id: 'ex-1',
            exerciseName: 'See notes',
            orderInDay: 1,
            sets: [{ type: 'normal', targetReps: 10 }],
            progressionRule: 'manual',
            primaryMuscle: 'unknown',
            secondaryMuscles: [],
            pattern: 'other',
            equipment: 'unknown',
            sfrTier: 'B',
            notes: truncatedNotes,
          },
        ],
      },
    ],
  };
}
