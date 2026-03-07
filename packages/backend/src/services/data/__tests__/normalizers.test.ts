import { describe, it, expect } from 'vitest';
import {
  normalizeNutritionRow,
  normalizeHevyRow,
  normalizeBiometricsRow,
  validateNormalizedRows,
} from '../normalizers.js';

const userId = '00000000-0000-0000-0000-000000000001';

describe('normalizeNutritionRow', () => {
  it('decomposes a full nutrition record into multiple measurement rows', () => {
    const raw = {
      date: '2026-03-01',
      energy_kcal: '2000',
      protein_g: '150',
      carbs_g: '200',
      fat_g: '80',
      fiber_g: '25',
    };

    const rows = normalizeNutritionRow(raw, userId, 'cronometer');
    expect(rows).toHaveLength(5);
    expect(rows.map(r => r.metric)).toEqual(
      expect.arrayContaining(['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g']),
    );
    expect(rows[0].userId).toBe(userId);
    expect(rows[0].source).toBe('cronometer');
    expect(rows[0].category).toBe('nutrition');
    expect(rows[0].measuredAt).toBeInstanceOf(Date);
  });

  it('skips macros with null/missing values', () => {
    const raw = { date: '2026-03-01', energy_kcal: '1800' };
    const rows = normalizeNutritionRow(raw, userId, 'cronometer');
    expect(rows).toHaveLength(1);
    expect(rows[0].metric).toBe('calories');
    expect(rows[0].value).toBe(1800);
  });

  it('accepts legacy Cronometer field names', () => {
    const raw = {
      Day: '2026-03-01',
      'Energy (kcal)': '2200',
      'Protein (g)': '120',
    };
    const rows = normalizeNutritionRow(raw, userId, 'cronometer');
    expect(rows).toHaveLength(2);
  });

  it('throws on invalid date', () => {
    expect(() =>
      normalizeNutritionRow({ date: 'not-a-date', energy_kcal: '100' }, userId, 'cronometer'),
    ).toThrow('Invalid or missing date');
  });

  it('returns empty array when no macro values present', () => {
    const rows = normalizeNutritionRow({ date: '2026-03-01' }, userId, 'cronometer');
    expect(rows).toHaveLength(0);
  });
});

describe('normalizeHevyRow', () => {
  it('maps all fields correctly', () => {
    const raw = {
      exercise_name: 'Barbell Squat',
      set_index: 0,
      weight_kg: '100',
      reps: '5',
      duration_seconds: null,
      distance_meters: null,
      rpe: '8',
      start_time: '2026-03-01T10:00:00Z',
      end_time: '2026-03-01T10:01:00Z',
    };

    const row = normalizeHevyRow(raw, userId);
    expect(row.exerciseName).toBe('Barbell Squat');
    expect(row.setIndex).toBe(0);
    expect(row.weightKg).toBe(100);
    expect(row.reps).toBe(5);
    expect(row.rpe).toBe(8);
    expect(row.startedAt).toBeInstanceOf(Date);
    expect(row.endedAt).toBeInstanceOf(Date);
    expect(row.source).toBe('hevy');
    expect(row.userId).toBe(userId);
  });

  it('sets optional fields to null when missing', () => {
    const raw = { exercise_name: 'Pull-up', set_index: 1, reps: '8' };
    const row = normalizeHevyRow(raw, userId);
    expect(row.weightKg).toBeNull();
    expect(row.durationSeconds).toBeNull();
    expect(row.startedAt).toBeNull();
  });

  it('handles zero values correctly (not null)', () => {
    const raw = { exercise_name: 'Plank', set_index: 0, weight_kg: '0', duration_seconds: '60' };
    const row = normalizeHevyRow(raw, userId);
    expect(row.weightKg).toBe(0);
    expect(row.durationSeconds).toBe(60);
  });
});

describe('normalizeBiometricsRow', () => {
  it('maps biometric fields correctly', () => {
    const raw = { date: '2026-03-01', metric: 'weight_kg', value: '82.5', unit: 'kg' };
    const row = normalizeBiometricsRow(raw, userId, 'cronometer');
    expect(row.category).toBe('biometric');
    expect(row.metric).toBe('weight_kg');
    expect(row.value).toBe(82.5);
    expect(row.unit).toBe('kg');
    expect(row.measuredAt).toBeInstanceOf(Date);
  });

  it('accepts legacy Cronometer field names', () => {
    const raw = { Day: '2026-03-01', Metric: 'body_fat_pct', Amount: '18.5', Unit: '%' };
    const row = normalizeBiometricsRow(raw, userId, 'cronometer');
    expect(row.value).toBe(18.5);
  });

  it('throws when value is missing', () => {
    expect(() =>
      normalizeBiometricsRow({ date: '2026-03-01', metric: 'weight_kg' }, userId, 'cronometer'),
    ).toThrow('Missing value');
  });
});

describe('validateNormalizedRows', () => {
  it('separates valid rows from rows with errors', () => {
    const rows = [
      { value: 10 },
      { value: -1 },
      { value: 5 },
    ];

    const { valid, errors } = validateNormalizedRows(rows, row =>
      row.value < 0 ? [`Value ${row.value} is negative`] : [],
    );

    expect(valid).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('negative');
  });

  it('returns all rows as valid when no errors', () => {
    const rows = [{ value: 1 }, { value: 2 }];
    const { valid, errors } = validateNormalizedRows(rows, () => []);
    expect(valid).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });
});
