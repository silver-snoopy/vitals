import type { Candidate } from './progression-rules.js';

// ---------------------------------------------------------------------------
// Injury keyword → muscle group mapping
// ---------------------------------------------------------------------------

interface InjuryMuscleMap {
  keywords: string[];
  muscles: string[];
}

const INJURY_MUSCLE_MAPS: InjuryMuscleMap[] = [
  {
    keywords: ['shoulder'],
    muscles: ['front deltoid', 'lateral deltoid', 'rear deltoid', 'rotator cuff'],
  },
  { keywords: ['knee'], muscles: ['quads', 'hamstrings', 'calves'] },
  // 'back' narrowed to 'lower back' / 'lumbar' to avoid false-positive on day names like "Back Day"
  { keywords: ['lower back', 'lumbar', 'spine'], muscles: ['lower back', 'upper back', 'lats'] },
  { keywords: ['elbow'], muscles: ['biceps', 'triceps', 'brachialis'] },
  { keywords: ['wrist'], muscles: ['biceps', 'triceps', 'forearms'] },
  { keywords: ['hip'], muscles: ['glutes', 'hip flexors', 'quads'] },
  { keywords: ['ankle', 'achilles'], muscles: ['calves'] },
  { keywords: ['chest', 'pec'], muscles: ['chest', 'upper chest'] },
];

/** Regex that matches injury signal words. */
const INJURY_SIGNAL_RE = /\b(pain|sharp|sore|strain|tweaked|injur|hurts?|flare|twinge|inflam)\b/i;

// ---------------------------------------------------------------------------
// applyLoadCap
// ---------------------------------------------------------------------------

/**
 * Per-exercise load cap: proposed load change must not exceed ±10% of current load.
 * Clips the proposed load to the nearest bound if exceeded.
 *
 * @param candidate - Candidate with a load-change newValue (array of PlanSet-like objects).
 * @param currentWeightKg - Current target weight in kg.
 * @returns Adjusted candidate with load clipped to ±10%.
 */
export function applyLoadCap(candidate: Candidate, currentWeightKg: number): Candidate {
  if (candidate.changeType !== 'progress_load' && candidate.changeType !== 'deload') {
    return candidate;
  }

  if (!Array.isArray(candidate.newValue)) return candidate;

  const maxIncrease = currentWeightKg * 1.1;
  const maxDecrease = currentWeightKg * 0.9;

  const capped = (candidate.newValue as Array<Record<string, unknown>>).map((set) => {
    const w = set['targetWeightKg'];
    if (typeof w !== 'number') return set;
    const clampedWeight = Math.min(maxIncrease, Math.max(maxDecrease, w));
    // Round to nearest 0.5 kg increment
    const rounded = Math.round(clampedWeight * 2) / 2;
    return { ...set, targetWeightKg: rounded };
  });

  return {
    ...candidate,
    newValue: capped,
  };
}

// ---------------------------------------------------------------------------
// applyVolumeCap
// ---------------------------------------------------------------------------

/**
 * Per-day volume cap: proposed total sets per primary muscle must not increase
 * by more than 30% (1.3×) from the 4-week rolling average for that day.
 *
 * For simplicity in v1, we compare proposed set count against currentDayVolume.
 *
 * @param candidates - All candidates (one per exercise) in a single day.
 * @param currentDayVolume - Current total sets for the muscle group on this day.
 * @param primaryMuscle - Muscle group being checked.
 * @returns Filtered candidates that respect the cap.
 */
export function applyVolumeCap(
  candidates: Candidate[],
  currentDayVolume: number,
  _primaryMuscle: string,
): Candidate[] {
  // Count proposed sets across all candidates for the day
  let proposedVolume = 0;
  for (const c of candidates) {
    if (Array.isArray(c.newValue)) {
      proposedVolume += (c.newValue as unknown[]).length;
    }
  }

  const cap = currentDayVolume * 1.3;
  if (proposedVolume <= cap) return candidates;

  // Volume exceeds cap — return candidates as-is; volume cap is a filter signal.
  // The safest approach: block any candidate that adds sets (keeps holds/deloads only).
  return candidates.map((c) => {
    if (!Array.isArray(c.newValue)) return c;
    const setCount = (c.newValue as unknown[]).length;
    if (setCount > currentDayVolume) {
      // Too many sets — truncate to current volume
      return {
        ...c,
        newValue: (c.newValue as unknown[]).slice(0, currentDayVolume),
        rationale: c.rationale + ' (volume cap: sets reduced to stay within 130% of baseline)',
      };
    }
    return c;
  });
}

// ---------------------------------------------------------------------------
// applyMaxChangeRatio
// ---------------------------------------------------------------------------

/**
 * Max-change-ratio cap: no more than 40% of plan exercises may be changed in a
 * single batch. Truncates the selection if needed, keeping highest-confidence
 * candidates first.
 *
 * @param allCandidates - Map of exerciseKey → selected candidate.
 * @param totalExerciseCount - Total number of exercises in the plan.
 * @returns Pruned map with at most 40% of exercises changed.
 */
export function applyMaxChangeRatio(
  allCandidates: Map<string, Candidate>,
  totalExerciseCount: number,
): Map<string, Candidate> {
  const maxChanged = Math.floor(totalExerciseCount * 0.4);

  // Separate holds from non-holds
  const changed: Array<[string, Candidate]> = [];
  const holds: Array<[string, Candidate]> = [];

  for (const [key, candidate] of allCandidates.entries()) {
    if (candidate.changeType === 'hold') {
      holds.push([key, candidate]);
    } else {
      changed.push([key, candidate]);
    }
  }

  if (changed.length <= maxChanged) {
    return allCandidates;
  }

  // Sort changed by confidence descending, keep top maxChanged
  changed.sort((a, b) => (b[1].confidence ?? 3) - (a[1].confidence ?? 3));
  const kept = changed.slice(0, maxChanged);
  const demoted = changed.slice(maxChanged);

  const result = new Map<string, Candidate>();
  for (const [key, candidate] of holds) {
    result.set(key, candidate);
  }
  for (const [key, candidate] of kept) {
    result.set(key, candidate);
  }
  // Demoted exercises become holds
  for (const [key, candidate] of demoted) {
    result.set(key, {
      changeType: 'hold',
      newValue: candidate.newValue, // Keep old sets value
      rationale: 'Max change ratio cap: too many exercises changed in one batch — holding.',
      confidence: 3,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// applyInjuryLock
// ---------------------------------------------------------------------------

/**
 * Injury keyword lock: scans user-supplied notes/report hazards for injury
 * signals. If a muscle group is implicated, locks matching exercises to hold.
 *
 * @param exerciseMuscle - Primary muscle of the exercise being checked.
 * @param hazardText - Combined text from report hazards + user notes.
 * @param holdCandidate - The hold candidate to substitute if locked.
 * @param originalCandidate - The candidate to potentially override.
 * @returns The original candidate, or holdCandidate if injury lock applies.
 */
export function applyInjuryLock(
  exerciseMuscle: string,
  hazardText: string,
  holdCandidate: Candidate,
  originalCandidate: Candidate,
): Candidate {
  if (!hazardText || !INJURY_SIGNAL_RE.test(hazardText)) {
    return originalCandidate;
  }

  for (const { keywords, muscles } of INJURY_MUSCLE_MAPS) {
    // Use word-boundary regex to avoid false-positives (e.g. 'back' in 'Back Day')
    const hasKeyword = keywords.some((kw) => new RegExp('\\b' + kw + '\\b', 'i').test(hazardText));
    if (!hasKeyword) continue;

    const matchesMuscle = muscles.some((m) => m.toLowerCase() === exerciseMuscle.toLowerCase());
    if (matchesMuscle) {
      return {
        ...holdCandidate,
        rationale: `Injury lock: detected injury signal near "${keywords.join('/')}" muscles — holding ${exerciseMuscle} exercises.`,
        confidence: 5,
      };
    }
  }

  return originalCandidate;
}
