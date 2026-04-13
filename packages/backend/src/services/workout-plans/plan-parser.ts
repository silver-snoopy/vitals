import type {
  AIProvider,
  PlanData,
  PlanDay,
  PlanExercise,
  PlanSet,
  ProgressionRule,
  SfrTier,
  StructuredOutputConfig,
} from '@vitals/shared';
import { getExerciseMeta } from './exercise-metadata.js';
import { completeStructuredWithRetry } from '../ai/retry-utils.js';
import { flagSuspiciousInput } from '../ai/conversation-service.js';

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

const PLAN_PARSER_SCHEMA: StructuredOutputConfig = {
  name: 'submit_parsed_plan',
  description: 'Submit the structured workout plan parsed from free text',
  schema: {
    type: 'object',
    required: ['splitType', 'progressionPersonality', 'days'],
    properties: {
      splitType: { type: 'string', description: 'PPL, UL, FB, or Custom' },
      progressionPersonality: {
        type: 'string',
        enum: ['conservative', 'balanced', 'aggressive'],
      },
      days: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'targetMuscles', 'exercises'],
          properties: {
            name: { type: 'string' },
            targetMuscles: { type: 'array', items: { type: 'string' } },
            exercises: {
              type: 'array',
              items: {
                type: 'object',
                required: [
                  'id',
                  'exerciseName',
                  'orderInDay',
                  'sets',
                  'progressionRule',
                  'primaryMuscle',
                  'secondaryMuscles',
                  'pattern',
                  'equipment',
                  'sfrTier',
                ],
                properties: {
                  id: { type: 'string' },
                  exerciseName: { type: 'string' },
                  orderInDay: { type: 'number' },
                  supersetGroup: { type: 'number' },
                  sets: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['type', 'targetReps'],
                      properties: {
                        type: {
                          type: 'string',
                          enum: ['warmup', 'normal', 'drop', 'failure', 'amrap'],
                        },
                        targetReps: {},
                        targetWeightKg: { type: 'number' },
                        targetRpe: { type: 'number' },
                        restSec: { type: 'number' },
                      },
                    },
                  },
                  progressionRule: {
                    type: 'string',
                    enum: ['double', 'linear', 'rpe_stop', 'manual'],
                  },
                  primaryMuscle: { type: 'string' },
                  secondaryMuscles: { type: 'array', items: { type: 'string' } },
                  pattern: {
                    type: 'string',
                    description: 'push, pull, hinge, squat, carry, isolation, other',
                  },
                  equipment: {
                    type: 'string',
                    description: 'barbell, dumbbell, cable, machine, bodyweight, other',
                  },
                  sfrTier: { type: 'string', enum: ['S', 'A', 'B', 'C'] },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
};

const PARSER_SYSTEM_PROMPT = `You are an expert strength and conditioning coach. Parse the provided free-text workout plan into structured data.

## Rules
1. Identify exercise names, sets, reps, weight, and RPE from ANY format.
2. Classify exercises by muscle group, movement pattern, equipment, and SFR tier.
3. S-tier = big compounds (bench, squat, deadlift, overhead press, barbell row, pull-ups, chin-ups).
4. A-tier = secondary compounds (dumbbell press, lunges, RDL). B-tier = accessories. C-tier = isolation.
5. Infer split type from day structure: PPL (push/pull/legs), UL (upper/lower), FB (full body), or Custom.
6. Progression rules: S-tier → 'linear', everything else → 'double'.
7. Generate stable IDs for exercises in format 'ex-N' where N is the order (1-based).
8. Default progressionPersonality to 'balanced'.
9. If you can't determine a field, use reasonable defaults (unknown muscle, 'other' pattern, 'unknown' equipment, 'B' sfrTier).`;

/**
 * Parses a free-text workout plan using LLM structured output with regex fallback.
 * When aiProvider is available, uses LLM for intelligent parsing.
 * Falls back to regex parser when aiProvider is null/undefined (dev mode, tests).
 */
export async function parseFreeTextPlan(
  rawText: string,
  aiProvider?: AIProvider,
): Promise<PlanData> {
  if (!rawText || rawText.trim().length === 0) {
    return buildFallback(rawText);
  }

  // If no AI provider, fall back to regex parser
  if (!aiProvider || !aiProvider.completeStructured) {
    return parseFreeTextPlanRegex(rawText);
  }

  try {
    // Defense-in-depth: warn if user text contains prompt-injection patterns
    if (flagSuspiciousInput(rawText)) {
      console.warn('[plan-parser] suspicious input detected in rawText');
    }

    const messages = [
      { role: 'system' as const, content: PARSER_SYSTEM_PROMPT },
      { role: 'user' as const, content: rawText },
    ];

    const result = await completeStructuredWithRetry<PlanData>(
      aiProvider,
      messages,
      PLAN_PARSER_SCHEMA,
    );

    // Post-process with exercise metadata to enrich/correct classification
    for (const day of result.data.days) {
      for (const exercise of day.exercises) {
        const meta = getExerciseMeta(exercise.exerciseName);
        if (meta.primaryMuscle !== 'unknown') {
          exercise.primaryMuscle = meta.primaryMuscle;
          exercise.secondaryMuscles = meta.secondaryMuscles;
          exercise.pattern = meta.pattern;
          exercise.equipment = meta.equipment;
          exercise.sfrTier = meta.sfrTier;
          exercise.progressionRule = inferProgressionRule(meta.sfrTier);
        }
      }
    }

    return result.data;
  } catch (err) {
    console.warn('[plan-parser] LLM parsing failed, falling back to regex parser:', err);
    return parseFreeTextPlanRegex(rawText);
  }
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
export function parseFreeTextPlanRegex(rawText: string): PlanData {
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
