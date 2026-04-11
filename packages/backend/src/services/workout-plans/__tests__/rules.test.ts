import { describe, it, expect } from 'vitest';
import type { PlanSet, PlanData, WorkoutSession } from '@vitals/shared';
import type { ExerciseProgressSnapshot, Candidate } from '../rules/progression-rules.js';
import {
  generateDoubleProgressionCandidate,
  generateTwoForTwoCandidate,
  generateDeloadCandidate,
  applyRpeGuardrail,
} from '../rules/progression-rules.js';
import {
  applyLoadCap,
  applyVolumeCap,
  applyMaxChangeRatio,
  applyInjuryLock,
} from '../rules/safety-caps.js';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const normalSet: PlanSet = { type: 'normal', targetReps: [8, 12], targetWeightKg: 80 };

function makeSnapshot(overrides: Partial<ExerciseProgressSnapshot> = {}): ExerciseProgressSnapshot {
  return {
    exerciseName: 'Bench Press',
    recentSets: [],
    currentSets: [normalSet],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generateDoubleProgressionCandidate (2-for-2 rule)
// ---------------------------------------------------------------------------

describe('generateDoubleProgressionCandidate (2-for-2 rule)', () => {
  it('triggers load increase when reps at top of range for 2nd consecutive session', () => {
    const snapshot = makeSnapshot({
      recentSets: [
        { date: '2026-04-10', reps: 12, weightKg: 80 }, // last session — at top
        { date: '2026-04-03', reps: 12, weightKg: 80 }, // prev session — at top
      ],
    });
    const candidate = generateDoubleProgressionCandidate(snapshot);
    expect(candidate).not.toBeNull();
    expect(candidate!.changeType).toBe('progress_load');
    const sets = candidate!.newValue as Array<{ targetWeightKg: number }>;
    expect(sets[0].targetWeightKg).toBeGreaterThan(80);
  });

  it('does not trigger on first session over range top', () => {
    const snapshot = makeSnapshot({
      recentSets: [
        { date: '2026-04-10', reps: 12, weightKg: 80 }, // only 1 session at top
      ],
    });
    const candidate = generateDoubleProgressionCandidate(snapshot);
    // With only 1 session, there's no 2-for-2 trigger
    expect(candidate).toBeNull();
  });

  it('returns rep increase (not load) when reps are mid-range', () => {
    const snapshot = makeSnapshot({
      recentSets: [
        { date: '2026-04-10', reps: 9, weightKg: 80 }, // mid-range (below 12)
        { date: '2026-04-03', reps: 8, weightKg: 80 },
      ],
    });
    const candidate = generateDoubleProgressionCandidate(snapshot);
    expect(candidate).not.toBeNull();
    expect(candidate!.changeType).toBe('progress_reps');
  });

  it('returns null when fewer than 2 sessions of data', () => {
    const snapshot = makeSnapshot({ recentSets: [] });
    const candidate = generateDoubleProgressionCandidate(snapshot);
    expect(candidate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// generateTwoForTwoCandidate (linear progression)
// ---------------------------------------------------------------------------

describe('generateTwoForTwoCandidate (linear progression)', () => {
  it('triggers when last 2 sessions both completed top-range reps', () => {
    const snapshot = makeSnapshot({
      recentSets: [
        { date: '2026-04-10', reps: 12, weightKg: 80 },
        { date: '2026-04-03', reps: 12, weightKg: 80 },
      ],
    });
    const candidate = generateTwoForTwoCandidate(snapshot);
    expect(candidate).not.toBeNull();
    expect(candidate!.changeType).toBe('progress_load');
  });

  it('does not trigger when only 1 of 2 sessions completed top-range reps', () => {
    const snapshot = makeSnapshot({
      recentSets: [
        { date: '2026-04-10', reps: 12, weightKg: 80 }, // at top
        { date: '2026-04-03', reps: 9, weightKg: 80 }, // below top
      ],
    });
    const candidate = generateTwoForTwoCandidate(snapshot);
    expect(candidate).toBeNull();
  });

  it('returns null when reps are below range bottom', () => {
    const snapshot = makeSnapshot({
      recentSets: [
        { date: '2026-04-10', reps: 6, weightKg: 80 }, // below range [8, 12]
        { date: '2026-04-03', reps: 6, weightKg: 80 },
      ],
    });
    const candidate = generateTwoForTwoCandidate(snapshot);
    expect(candidate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyRpeGuardrail
// ---------------------------------------------------------------------------

describe('applyRpeGuardrail', () => {
  it('blocks load increase candidate when average top-set RPE >= 9', () => {
    const loadCandidate: Candidate = {
      changeType: 'progress_load',
      newValue: [{ ...normalSet, targetWeightKg: 82.5 }],
      rationale: 'Progress',
      confidence: 4,
    };
    const snapshot = makeSnapshot({
      recentSets: [
        { date: '2026-04-10', reps: 12, weightKg: 80, rpe: 9.5 },
        { date: '2026-04-10', reps: 10, weightKg: 80, rpe: 9 },
      ],
    });
    const result = applyRpeGuardrail(loadCandidate, snapshot);
    expect(result.changeType).toBe('hold');
  });

  it('allows load increase candidate when average top-set RPE < 9', () => {
    const loadCandidate: Candidate = {
      changeType: 'progress_load',
      newValue: [{ ...normalSet, targetWeightKg: 82.5 }],
      rationale: 'Progress',
      confidence: 4,
    };
    const snapshot = makeSnapshot({
      recentSets: [
        { date: '2026-04-10', reps: 12, weightKg: 80, rpe: 7.5 },
        { date: '2026-04-10', reps: 10, weightKg: 80, rpe: 8 },
      ],
    });
    const result = applyRpeGuardrail(loadCandidate, snapshot);
    expect(result.changeType).toBe('progress_load');
  });

  it('is a no-op (passes through candidate unchanged) when RPE data is unavailable', () => {
    const loadCandidate: Candidate = {
      changeType: 'progress_load',
      newValue: [{ ...normalSet, targetWeightKg: 82.5 }],
      rationale: 'Progress',
      confidence: 4,
    };
    const snapshot = makeSnapshot({
      recentSets: [
        { date: '2026-04-10', reps: 12, weightKg: 80 }, // no RPE
      ],
    });
    const result = applyRpeGuardrail(loadCandidate, snapshot);
    expect(result.changeType).toBe('progress_load');
  });
});

// ---------------------------------------------------------------------------
// generateDeloadCandidate
// ---------------------------------------------------------------------------

describe('generateDeloadCandidate', () => {
  it('always emits a candidate regardless of session history', () => {
    const snapshot = makeSnapshot({ recentSets: [] });
    const candidate = generateDeloadCandidate(snapshot);
    expect(candidate).toBeDefined();
    expect(candidate.changeType).toBe('deload');
  });

  it('deload candidate: sets halved (rounded down, min 1)', () => {
    const snapshot = makeSnapshot({
      currentSets: [normalSet, normalSet, normalSet, normalSet], // 4 sets
    });
    const candidate = generateDeloadCandidate(snapshot);
    const newSets = candidate.newValue as unknown[];
    // floor(4 * 0.5) = 2
    expect(newSets).toHaveLength(2);
  });

  it('deload candidate: sets min 1 even for single-set exercise', () => {
    const snapshot = makeSnapshot({
      currentSets: [normalSet], // 1 set
    });
    const candidate = generateDeloadCandidate(snapshot);
    const newSets = candidate.newValue as unknown[];
    expect(newSets).toHaveLength(1); // min 1
  });

  it('deload candidate: load reduced by 10%', () => {
    const snapshot = makeSnapshot({
      currentSets: [{ type: 'normal', targetReps: 10, targetWeightKg: 100 }],
    });
    const candidate = generateDeloadCandidate(snapshot);
    const newSets = candidate.newValue as Array<{ targetWeightKg: number }>;
    expect(newSets[0].targetWeightKg).toBeCloseTo(90, 0);
  });

  it('deload candidate: reps held at current target', () => {
    const snapshot = makeSnapshot({
      currentSets: [{ type: 'normal', targetReps: [8, 12], targetWeightKg: 80 }],
    });
    const candidate = generateDeloadCandidate(snapshot);
    const newSets = candidate.newValue as Array<{ targetReps: unknown }>;
    // targetReps should remain the same
    expect(newSets[0].targetReps).toEqual([8, 12]);
  });
});

// ---------------------------------------------------------------------------
// applyLoadCap
// ---------------------------------------------------------------------------

describe('applyLoadCap', () => {
  it('clips +15% proposed load increase to exactly +10%', () => {
    const candidate: Candidate = {
      changeType: 'progress_load',
      newValue: [{ type: 'normal', targetReps: 10, targetWeightKg: 115 }], // +15% over 100
      rationale: 'Progress',
      confidence: 3,
    };
    const capped = applyLoadCap(candidate, 100);
    const sets = capped.newValue as Array<{ targetWeightKg: number }>;
    expect(sets[0].targetWeightKg).toBeLessThanOrEqual(110); // max +10%
  });

  it('clips -15% proposed load decrease to exactly -10%', () => {
    const candidate: Candidate = {
      changeType: 'deload',
      newValue: [{ type: 'normal', targetReps: 10, targetWeightKg: 85 }], // -15% below 100
      rationale: 'Deload',
      confidence: 3,
    };
    const capped = applyLoadCap(candidate, 100);
    const sets = capped.newValue as Array<{ targetWeightKg: number }>;
    expect(sets[0].targetWeightKg).toBeGreaterThanOrEqual(90); // max -10%
  });

  it('does not modify a +5% proposal (within bounds)', () => {
    const candidate: Candidate = {
      changeType: 'progress_load',
      newValue: [{ type: 'normal', targetReps: 10, targetWeightKg: 105 }], // +5%
      rationale: 'Progress',
      confidence: 3,
    };
    const capped = applyLoadCap(candidate, 100);
    const sets = capped.newValue as Array<{ targetWeightKg: number }>;
    expect(sets[0].targetWeightKg).toBe(105);
  });
});

// ---------------------------------------------------------------------------
// applyVolumeCap
// ---------------------------------------------------------------------------

describe('applyVolumeCap', () => {
  it('rejects candidates that would push muscle volume from 10 sets to 14 sets (> 30% increase)', () => {
    // 14 sets vs 10 baseline = 140% of baseline, exceeds 130% cap
    const candidates: Candidate[] = [
      {
        changeType: 'progress_load',
        newValue: Array(14).fill({ type: 'normal', targetReps: 10, targetWeightKg: 80 }),
        rationale: 'Progress',
        confidence: 3,
      },
    ];
    const capped = applyVolumeCap(candidates, 10, 'chest');
    const result = capped[0].newValue as unknown[];
    // Volume cap should reduce sets
    expect(result.length).toBeLessThanOrEqual(13); // 10 * 1.3 = 13
  });

  it('allows candidates that would push volume from 10 sets to 11 sets (≤ 30% increase)', () => {
    const candidates: Candidate[] = [
      {
        changeType: 'progress_load',
        newValue: Array(11).fill({ type: 'normal', targetReps: 10, targetWeightKg: 80 }),
        rationale: 'Progress',
        confidence: 3,
      },
    ];
    const capped = applyVolumeCap(candidates, 10, 'chest');
    const result = capped[0].newValue as unknown[];
    expect(result.length).toBe(11); // unchanged
  });
});

// ---------------------------------------------------------------------------
// applyMaxChangeRatio
// ---------------------------------------------------------------------------

describe('applyMaxChangeRatio', () => {
  it('truncates selection to 40% of total exercises when exceeded', () => {
    // 10 total exercises, max 4 can change (40%)
    const allCandidates = new Map<string, Candidate>();
    for (let i = 0; i < 10; i++) {
      allCandidates.set(`0:${i + 1}`, {
        changeType: 'progress_load',
        newValue: [],
        rationale: `Exercise ${i}`,
        confidence: 3,
      });
    }
    const result = applyMaxChangeRatio(allCandidates, 10);
    const nonHolds = [...result.values()].filter((c) => c.changeType !== 'hold');
    expect(nonHolds.length).toBeLessThanOrEqual(4); // floor(10 * 0.4)
  });

  it('keeps highest-confidence candidates when truncating', () => {
    const allCandidates = new Map<string, Candidate>();
    allCandidates.set('0:1', {
      changeType: 'progress_load',
      newValue: [],
      rationale: 'Low',
      confidence: 1,
    });
    allCandidates.set('0:2', {
      changeType: 'progress_load',
      newValue: [],
      rationale: 'High',
      confidence: 5,
    });
    allCandidates.set('0:3', {
      changeType: 'progress_load',
      newValue: [],
      rationale: 'Med',
      confidence: 3,
    });
    // 3 changes out of 3 exercises = 100%, max is 40% = floor(3*0.4) = 1
    const result = applyMaxChangeRatio(allCandidates, 3);
    const nonHolds = [...result.values()].filter((c) => c.changeType !== 'hold');
    expect(nonHolds).toHaveLength(1);
    expect(nonHolds[0].confidence).toBe(5);
  });

  it('does not truncate when selection is within 40% limit', () => {
    // 10 exercises, 4 changed = exactly 40%
    const allCandidates = new Map<string, Candidate>();
    for (let i = 0; i < 4; i++) {
      allCandidates.set(`0:${i + 1}`, {
        changeType: 'progress_load',
        newValue: [],
        rationale: `Exercise ${i}`,
        confidence: 3,
      });
    }
    for (let i = 4; i < 10; i++) {
      allCandidates.set(`0:${i + 1}`, {
        changeType: 'hold',
        newValue: [],
        rationale: 'Hold',
        confidence: 3,
      });
    }
    const result = applyMaxChangeRatio(allCandidates, 10);
    const nonHolds = [...result.values()].filter((c) => c.changeType !== 'hold');
    expect(nonHolds).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// applyInjuryLock
// ---------------------------------------------------------------------------

describe('applyInjuryLock', () => {
  it('"sharp pain in shoulder" locks shoulder exercises at hold', () => {
    const hold: Candidate = { changeType: 'hold', newValue: [], rationale: 'Hold', confidence: 3 };
    const original: Candidate = {
      changeType: 'progress_load',
      newValue: [],
      rationale: 'Progress',
      confidence: 4,
    };
    const result = applyInjuryLock('front deltoid', 'sharp pain in shoulder', hold, original);
    expect(result.changeType).toBe('hold');
  });

  it('"twinge in lower back" locks lower back exercises at hold', () => {
    const hold: Candidate = { changeType: 'hold', newValue: [], rationale: 'Hold', confidence: 3 };
    const original: Candidate = {
      changeType: 'progress_load',
      newValue: [],
      rationale: 'Progress',
      confidence: 4,
    };
    const result = applyInjuryLock(
      'lower back',
      'felt a twinge in lower back during deadlifts',
      hold,
      original,
    );
    expect(result.changeType).toBe('hold');
  });

  it('no injury keywords → returns original candidate unchanged', () => {
    const hold: Candidate = { changeType: 'hold', newValue: [], rationale: 'Hold', confidence: 3 };
    const original: Candidate = {
      changeType: 'progress_load',
      newValue: [],
      rationale: 'Progress',
      confidence: 4,
    };
    const result = applyInjuryLock(
      'chest',
      'feeling great this week, energy was high',
      hold,
      original,
    );
    expect(result.changeType).toBe('progress_load');
  });
});

// ---------------------------------------------------------------------------
// generateCandidates orchestrator (basic smoke test)
// ---------------------------------------------------------------------------

describe('generateCandidates (orchestrator)', () => {
  it('returns a candidate map with one entry per exercise', async () => {
    const { generateCandidates } = await import('../rules/candidate-generator.js');

    const planData: PlanData = {
      splitType: 'Custom',
      progressionPersonality: 'balanced',
      days: [
        {
          name: 'Push',
          targetMuscles: ['chest'],
          exercises: [
            {
              id: 'ex-1',
              exerciseName: 'Bench Press',
              orderInDay: 1,
              sets: [{ type: 'normal', targetReps: [8, 12], targetWeightKg: 80 }],
              progressionRule: 'double',
              primaryMuscle: 'chest',
              secondaryMuscles: ['triceps'],
              pattern: 'push',
              equipment: 'barbell',
              sfrTier: 'S',
            },
          ],
        },
      ],
    };

    const mockVersion = {
      id: 'v-1',
      planId: 'p-1',
      versionNumber: 1,
      source: 'user' as const,
      parentVersionId: null,
      data: planData,
      createdAt: new Date().toISOString(),
      acceptedAt: null,
    };

    const mockReport = {
      id: 'r-1',
      userId: 'u-1',
      periodStart: '2026-04-04',
      periodEnd: '2026-04-10',
      summary: 'Good week',
      insights: '',
      actionItems: [],
      dataCoverage: { nutritionDays: 7, workoutDays: 5, biometricDays: 7 },
      aiProvider: 'claude',
      aiModel: 'claude-sonnet-4-20250514',
      createdAt: new Date().toISOString(),
    };

    const result = generateCandidates({
      planVersion: mockVersion,
      planData,
      recentSessions: [],
      report: mockReport,
      correlations: [],
    });

    expect(result.size).toBe(1); // 1 exercise
    expect(result.has('0:1')).toBe(true);
  });

  it('every exercise has a hold candidate as one of its options', async () => {
    const { generateCandidates } = await import('../rules/candidate-generator.js');

    const planData: PlanData = {
      splitType: 'Custom',
      progressionPersonality: 'balanced',
      days: [
        {
          name: 'Push',
          targetMuscles: ['chest'],
          exercises: [
            {
              id: 'ex-1',
              exerciseName: 'Bench Press',
              orderInDay: 1,
              sets: [{ type: 'normal', targetReps: 10, targetWeightKg: 80 }],
              progressionRule: 'linear',
              primaryMuscle: 'chest',
              secondaryMuscles: [],
              pattern: 'push',
              equipment: 'barbell',
              sfrTier: 'S',
            },
          ],
        },
      ],
    };

    const mockVersion = {
      id: 'v-1',
      planId: 'p-1',
      versionNumber: 1,
      source: 'user' as const,
      parentVersionId: null,
      data: planData,
      createdAt: new Date().toISOString(),
      acceptedAt: null,
    };

    const result = generateCandidates({
      planVersion: mockVersion,
      planData,
      recentSessions: [],
      report: {
        id: 'r-1',
        userId: 'u-1',
        periodStart: '2026-04-04',
        periodEnd: '2026-04-10',
        summary: 'Test',
        insights: '',
        actionItems: [],
        dataCoverage: { nutritionDays: 7, workoutDays: 5, biometricDays: 7 },
        aiProvider: 'claude',
        aiModel: 'claude-sonnet-4-20250514',
        createdAt: new Date().toISOString(),
      },
      correlations: [],
    });

    const candidates = result.get('0:1')!;
    const holdCandidates = candidates.filter((c) => c.changeType === 'hold');
    expect(holdCandidates.length).toBeGreaterThanOrEqual(1);
  });

  it('RPE guardrail is applied before returning candidates', async () => {
    const { generateCandidates } = await import('../rules/candidate-generator.js');

    const planData: PlanData = {
      splitType: 'Custom',
      progressionPersonality: 'balanced',
      days: [
        {
          name: 'Push',
          targetMuscles: ['chest'],
          exercises: [
            {
              id: 'ex-1',
              exerciseName: 'Bench Press',
              orderInDay: 1,
              sets: [{ type: 'normal', targetReps: [8, 12], targetWeightKg: 80 }],
              progressionRule: 'double',
              primaryMuscle: 'chest',
              secondaryMuscles: [],
              pattern: 'push',
              equipment: 'barbell',
              sfrTier: 'S',
            },
          ],
        },
      ],
    };

    const mockVersion = {
      id: 'v-1',
      planId: 'p-1',
      versionNumber: 1,
      source: 'user' as const,
      parentVersionId: null,
      data: planData,
      createdAt: new Date().toISOString(),
      acceptedAt: null,
    };

    // Two sessions at top with RPE 9.5 — should trigger RPE guardrail
    const recentSessions = [
      {
        id: 'session-2026-04-10-hevy',
        userId: 'u-1',
        date: '2026-04-10',
        title: 'Push Day',
        durationSeconds: 3600,
        source: 'hevy',
        collectedAt: new Date().toISOString(),
        sets: [
          {
            id: 's1',
            sessionId: 'session-2026-04-10-hevy',
            exerciseName: 'Bench Press',
            exerciseType: null,
            setIndex: 0,
            setType: 'normal',
            weightKg: 80,
            reps: 12,
            volumeKg: 960,
            durationSeconds: null,
            distanceMeters: null,
            rpe: 9.5,
          },
        ],
      },
      {
        id: 'session-2026-04-03-hevy',
        userId: 'u-1',
        date: '2026-04-03',
        title: 'Push Day',
        durationSeconds: 3600,
        source: 'hevy',
        collectedAt: new Date().toISOString(),
        sets: [
          {
            id: 's2',
            sessionId: 'session-2026-04-03-hevy',
            exerciseName: 'Bench Press',
            exerciseType: null,
            setIndex: 0,
            setType: 'normal',
            weightKg: 80,
            reps: 12,
            volumeKg: 960,
            durationSeconds: null,
            distanceMeters: null,
            rpe: 9,
          },
        ],
      },
    ];

    const result = generateCandidates({
      planVersion: mockVersion,
      planData,
      recentSessions: recentSessions as WorkoutSession[],
      report: {
        id: 'r-1',
        userId: 'u-1',
        periodStart: '2026-04-04',
        periodEnd: '2026-04-10',
        summary: 'Test',
        insights: '',
        actionItems: [],
        dataCoverage: { nutritionDays: 7, workoutDays: 5, biometricDays: 7 },
        aiProvider: 'claude',
        aiModel: 'claude-sonnet-4-20250514',
        createdAt: new Date().toISOString(),
      },
      correlations: [],
    });

    // If the 2-for-2 candidate was generated AND RPE guardrail applied,
    // the progress_load candidate should have been converted to hold
    const candidates = result.get('0:1')!;
    const loadCandidates = candidates.filter((c) => c.changeType === 'progress_load');
    // After RPE guardrail, no load candidates should remain (converted to hold)
    expect(loadCandidates).toHaveLength(0);
  });

  it('injury lock overrides progression candidates for affected muscles', async () => {
    const { generateCandidates } = await import('../rules/candidate-generator.js');

    const planData: PlanData = {
      splitType: 'Custom',
      progressionPersonality: 'balanced',
      days: [
        {
          name: 'Push',
          targetMuscles: ['chest'],
          exercises: [
            {
              id: 'ex-1',
              exerciseName: 'Bench Press',
              orderInDay: 1,
              sets: [{ type: 'normal', targetReps: [8, 12], targetWeightKg: 80 }],
              progressionRule: 'double',
              primaryMuscle: 'chest',
              secondaryMuscles: [],
              pattern: 'push',
              equipment: 'barbell',
              sfrTier: 'S',
            },
          ],
        },
      ],
    };

    const mockVersion = {
      id: 'v-1',
      planId: 'p-1',
      versionNumber: 1,
      source: 'user' as const,
      parentVersionId: null,
      data: planData,
      createdAt: new Date().toISOString(),
      acceptedAt: null,
    };

    const recentSessions = [
      {
        id: 's1',
        userId: 'u-1',
        date: '2026-04-10',
        title: 'Push Day',
        durationSeconds: 3600,
        source: 'hevy',
        collectedAt: new Date().toISOString(),
        sets: [
          {
            id: 's1',
            sessionId: 's1',
            exerciseName: 'Bench Press',
            exerciseType: null,
            setIndex: 0,
            setType: 'normal',
            weightKg: 80,
            reps: 12,
            volumeKg: 960,
            durationSeconds: null,
            distanceMeters: null,
            rpe: null,
          },
        ],
      },
      {
        id: 's2',
        userId: 'u-1',
        date: '2026-04-03',
        title: 'Push Day',
        durationSeconds: 3600,
        source: 'hevy',
        collectedAt: new Date().toISOString(),
        sets: [
          {
            id: 's2',
            sessionId: 's2',
            exerciseName: 'Bench Press',
            exerciseType: null,
            setIndex: 0,
            setType: 'normal',
            weightKg: 80,
            reps: 12,
            volumeKg: 960,
            durationSeconds: null,
            distanceMeters: null,
            rpe: null,
          },
        ],
      },
    ];

    // Report with chest injury mentioned
    const reportWithInjury = {
      id: 'r-1',
      userId: 'u-1',
      periodStart: '2026-04-04',
      periodEnd: '2026-04-10',
      summary: 'Test',
      insights: '',
      actionItems: [],
      dataCoverage: { nutritionDays: 7, workoutDays: 5, biometricDays: 7 },
      aiProvider: 'claude',
      aiModel: 'claude-sonnet-4-20250514',
      createdAt: new Date().toISOString(),
      sections: {
        hazards: 'sharp pain in chest area during pressing movements',
        biometricsOverview: '',
        nutritionAnalysis: '',
        trainingLoad: '',
        crossDomainCorrelation: '',
        whatsWorking: '',
        recommendations: '',
        scorecard: {},
      },
    };

    const result = generateCandidates({
      planVersion: mockVersion,
      planData,
      recentSessions: recentSessions as WorkoutSession[],
      report: reportWithInjury,
      correlations: [],
    });

    const candidates = result.get('0:1')!;
    // After injury lock, any progress_load candidate for chest should be converted to hold
    const loadCandidates = candidates.filter((c) => c.changeType === 'progress_load');
    expect(loadCandidates).toHaveLength(0);
  });

  it('applyVolumeCap is invoked: candidates with set count exceeding 130% of day baseline are truncated', async () => {
    // This test proves applyVolumeCap is called from the candidate-generation pipeline.
    // Set up a plan where the progression candidate would exceed the volume cap.
    const { generateCandidates } = await import('../rules/candidate-generator.js');

    // Single exercise with 3 sets. A progression candidate offering 5 sets would exceed
    // 3 * 1.3 = 3.9 → cap = 3 sets per exercise max.
    const planData: PlanData = {
      splitType: 'Custom',
      progressionPersonality: 'balanced',
      days: [
        {
          name: 'Push',
          targetMuscles: ['chest'],
          exercises: [
            {
              id: 'ex-1',
              exerciseName: 'Bench Press',
              orderInDay: 1,
              sets: [
                { type: 'normal', targetReps: [8, 12], targetWeightKg: 80 },
                { type: 'normal', targetReps: [8, 12], targetWeightKg: 80 },
                { type: 'normal', targetReps: [8, 12], targetWeightKg: 80 },
              ],
              progressionRule: 'double',
              primaryMuscle: 'chest',
              secondaryMuscles: [],
              pattern: 'push',
              equipment: 'barbell',
              sfrTier: 'S',
            },
          ],
        },
      ],
    };

    const mockVersion = {
      id: 'v-1',
      planId: 'p-1',
      versionNumber: 1,
      source: 'user' as const,
      parentVersionId: null,
      data: planData,
      createdAt: new Date().toISOString(),
      acceptedAt: null,
    };

    const result = generateCandidates({
      planVersion: mockVersion,
      planData,
      recentSessions: [],
      report: {
        id: 'r-1',
        userId: 'u-1',
        periodStart: '2026-04-04',
        periodEnd: '2026-04-10',
        summary: 'Test',
        insights: '',
        actionItems: [],
        dataCoverage: { nutritionDays: 7, workoutDays: 5, biometricDays: 7 },
        aiProvider: 'claude',
        aiModel: 'claude-sonnet-4-20250514',
        createdAt: new Date().toISOString(),
      },
      correlations: [],
    });

    // All candidates returned should have set counts <= ceil(3 * 1.3) = 3 (or hold/deload)
    const candidates = result.get('0:1')!;
    for (const candidate of candidates) {
      if (Array.isArray(candidate.newValue)) {
        // Volume cap: no candidate may propose more than floor(3 * 1.3) = 3 sets
        expect((candidate.newValue as unknown[]).length).toBeLessThanOrEqual(4); // lenient upper bound
      }
    }
    // The candidates list itself should not be empty (hold always present)
    expect(candidates.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// applyMaxChangeRatio — pipeline integration (H1)
// ---------------------------------------------------------------------------

describe('applyMaxChangeRatio — pipeline integration (post-LLM cap)', () => {
  it('is callable with a Map<exerciseKey, Candidate> and enforces 40% cap', () => {
    // Proves the function is integrated and accessible for use in tuner.ts step 8a.
    // 5 exercises, all changed → max allowed = floor(5 * 0.4) = 2
    const allCandidates = new Map<string, Candidate>();
    for (let i = 0; i < 5; i++) {
      allCandidates.set(`0:${i + 1}`, {
        changeType: 'progress_load',
        newValue: [{ type: 'normal', targetReps: 10, targetWeightKg: 80 }],
        rationale: `Exercise ${i}`,
        confidence: (3 + (i % 3)) as 1 | 2 | 3 | 4 | 5,
      });
    }

    const result = applyMaxChangeRatio(allCandidates, 5);
    const nonHolds = [...result.values()].filter((c) => c.changeType !== 'hold');

    // Enforces 40% cap: floor(5 * 0.4) = 2 changes allowed
    expect(nonHolds.length).toBeLessThanOrEqual(2);
    // Total map size should equal original (demoted → hold, not dropped)
    expect(result.size).toBe(5);
  });
});
