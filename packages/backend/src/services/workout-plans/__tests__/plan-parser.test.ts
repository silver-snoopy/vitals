import { describe, it, expect } from 'vitest';
import { parseFreeTextPlan } from '../plan-parser.js';

describe('parseFreeTextPlan', () => {
  it('empty string → returns single-day notes fallback plan', () => {
    const result = parseFreeTextPlan('');
    expect(result.splitType).toBe('Custom');
    expect(result.progressionPersonality).toBe('balanced');
    expect(result.days).toHaveLength(1);
    expect(result.days[0].name).toBe('My Plan');
    expect(result.days[0].exercises).toHaveLength(1);
    expect(result.days[0].exercises[0].notes).toBe('');
  });

  it('single-day plain text → parses one day with exercises', () => {
    const text = `Push Day
Bench Press 3x10 @ 80kg
Overhead Press 3x8-10 @ 50kg
Tricep Pushdown 3x12`;

    const result = parseFreeTextPlan(text);
    expect(result.days.length).toBeGreaterThanOrEqual(1);
    const day = result.days[0];
    expect(day.exercises.length).toBeGreaterThan(0);
    // Bench press should be found
    const bench = day.exercises.find((e) => e.exerciseName.toLowerCase().includes('bench'));
    expect(bench).toBeDefined();
    expect(bench!.sets).toHaveLength(3);
  });

  it('PPL split (Push/Pull/Legs) → parses three named days', () => {
    const text = `Push
Bench Press 3x8-12 @ 80kg
Overhead Press 3x8

Pull
Pull Up 3x10
Barbell Row 3x8

Legs
Barbell Squat 4x6 @ 100kg
Romanian Deadlift 3x10`;

    const result = parseFreeTextPlan(text);
    expect(result.days).toHaveLength(3);
    expect(result.splitType).toBe('PPL');
    expect(result.days[0].name.toLowerCase()).toContain('push');
    expect(result.days[1].name.toLowerCase()).toContain('pull');
    expect(result.days[2].name.toLowerCase()).toContain('leg');
  });

  it('unrecognizable text → falls back to single Notes day with raw text in notes', () => {
    const text = 'Do some stuff and maybe lift things occasionally when feeling good.';
    const result = parseFreeTextPlan(text);
    expect(result.days).toHaveLength(1);
    expect(result.days[0].name).toBe('My Plan');
    const firstEx = result.days[0].exercises[0];
    expect(firstEx.notes).toBe(text);
  });

  it('exercises with explicit rep ranges (e.g. "3×8–12") → targetReps is [8, 12]', () => {
    const text = `Push
Bench Press 3x8-12 @ 70kg`;

    const result = parseFreeTextPlan(text);
    const day = result.days[0];
    const bench = day.exercises.find((e) => e.exerciseName.toLowerCase().includes('bench'));
    expect(bench).toBeDefined();
    const firstSet = bench!.sets[0];
    expect(Array.isArray(firstSet.targetReps)).toBe(true);
    const reps = firstSet.targetReps as [number, number];
    expect(reps[0]).toBe(8);
    expect(reps[1]).toBe(12);
  });

  it('S-tier exercises get progressionRule "linear", others get "double"', () => {
    const text = `Push
Bench Press 3x5 @ 100kg
Tricep Pushdown 3x12`;

    const result = parseFreeTextPlan(text);
    const day = result.days[0];
    const bench = day.exercises.find((e) => e.exerciseName.toLowerCase().includes('bench'));
    const pushdown = day.exercises.find((e) => e.exerciseName.toLowerCase().includes('pushdown'));
    expect(bench).toBeDefined();
    expect(pushdown).toBeDefined();
    // Bench press is S-tier → linear (2-for-2 rule)
    expect(bench!.progressionRule).toBe('linear');
    // Tricep pushdown is A/B/C-tier → double progression
    expect(pushdown!.progressionRule).toBe('double');
  });

  it('"D1 — UPPER" day header format → parsed as day with exercises', () => {
    const text = `D1 — UPPER (HEAVY | ~1 RIR)
Iso-Lateral HS Bench — 4×5–7 @1 RIR
Weighted Pull-Ups — 4×4–6 @1 RIR

D2 — LEGS (HYPERTROPHY | 1–2 RIR)
Leg Extension — 3×12–15 @1 RIR
Seated Leg Curl — 3×12–15 @1 RIR`;

    const result = parseFreeTextPlan(text);
    expect(result.days).toHaveLength(2);
    expect(result.days[0].name).toContain('UPPER');
    expect(result.days[0].exercises.length).toBeGreaterThanOrEqual(2);
    // Exercise name should NOT include trailing em dash
    expect(result.days[0].exercises[0].exerciseName).not.toContain('—');
    expect(result.days[0].exercises[0].exerciseName).toContain('Bench');
    // RIR parsed as RPE value
    expect(result.days[0].exercises[0].sets[0].targetRpe).toBe(1);
    // Rep ranges parsed correctly
    const reps = result.days[0].exercises[0].sets[0].targetReps;
    expect(Array.isArray(reps)).toBe(true);
    expect((reps as [number, number])[0]).toBe(5);
    expect((reps as [number, number])[1]).toBe(7);
  });

  it('exercises with RPE targets (e.g. "3×5 @RPE 8") → targetRpe is 8', () => {
    const text = `Push
Bench Press 3x5 @RPE 8`;

    const result = parseFreeTextPlan(text);
    const day = result.days[0];
    const bench = day.exercises.find((e) => e.exerciseName.toLowerCase().includes('bench'));
    expect(bench).toBeDefined();
    const firstSet = bench!.sets[0];
    expect(firstSet.targetRpe).toBe(8);
  });
});
