import { describe, it, expect } from 'vitest';
import {
  pearsonCorrelation,
  calculatePValue,
  classifyConfidence,
  linearRegression,
  projectForward,
} from '../stats.js';

describe('pearsonCorrelation', () => {
  it('returns NaN for empty arrays', () => {
    expect(pearsonCorrelation([], [])).toBeNaN();
  });

  it('returns NaN for single-element arrays', () => {
    expect(pearsonCorrelation([1], [2])).toBeNaN();
  });

  it('returns NaN when xs has zero variance', () => {
    expect(pearsonCorrelation([5, 5, 5], [1, 2, 3])).toBeNaN();
  });

  it('returns NaN when ys has zero variance', () => {
    expect(pearsonCorrelation([1, 2, 3], [5, 5, 5])).toBeNaN();
  });

  it('returns NaN for mismatched array lengths', () => {
    expect(pearsonCorrelation([1, 2], [1, 2, 3])).toBeNaN();
  });

  it('returns 1 for perfect positive correlation', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [2, 4, 6, 8, 10];
    expect(pearsonCorrelation(xs, ys)).toBeCloseTo(1, 5);
  });

  it('returns -1 for perfect negative correlation', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [10, 8, 6, 4, 2];
    expect(pearsonCorrelation(xs, ys)).toBeCloseTo(-1, 5);
  });

  it('returns exactly 0 for perfectly uncorrelated data', () => {
    // xs is monotone increasing; ys is symmetric around mean — zero correlation by construction
    // sum((xi - meanX)*(yi - meanY)) = 0 when ys are symmetric: [-2, -1, 0, 1, 2] reversed on matched half
    const xs = [1, 2, 3, 4, 5, 6, 7];
    const ys = [3, 3, 3, 3, 3, 3, 3]; // constant — but this gives NaN; use a different approach
    // Build ys so cov(X,Y) = 0 exactly: pair high x with symmetric ys
    // xs = [1,2,3,4,5], ys = [5,1,3,1,5] — mean(ys)=3, deviations: 2,-2,0,-2,2
    // cov = (1-3)*2 + (2-3)*(-2) + (3-3)*0 + (4-3)*(-2) + (5-3)*2 = -4+2+0-2+4 = 0
    const xsActual = [1, 2, 3, 4, 5];
    const ysActual = [5, 1, 3, 1, 5];
    const r = pearsonCorrelation(xsActual, ysActual);
    expect(r).toBeCloseTo(0, 10);
  });

  it('computes a known partial correlation', () => {
    // Known result: corr([1,2,3,4,5], [1,3,2,5,4]) ≈ 0.8
    const xs = [1, 2, 3, 4, 5];
    const ys = [1, 3, 2, 5, 4];
    const r = pearsonCorrelation(xs, ys);
    expect(r).toBeGreaterThan(0.7);
    expect(r).toBeLessThan(1);
  });
});

describe('calculatePValue', () => {
  it('returns 1 for n <= 2', () => {
    expect(calculatePValue(0.9, 2)).toBe(1);
    expect(calculatePValue(0.5, 1)).toBe(1);
  });

  it('returns 1 for NaN r', () => {
    expect(calculatePValue(NaN, 10)).toBe(1);
  });

  it('returns a small p-value for high r with large n', () => {
    // r=0.9, n=30 should be very significant
    const p = calculatePValue(0.9, 30);
    expect(p).toBeLessThan(0.001);
  });

  it('returns a large p-value for low r with small n', () => {
    // r=0.2, n=5 should not be significant
    const p = calculatePValue(0.2, 5);
    expect(p).toBeGreaterThan(0.3);
  });

  it('returns p between 0 and 1', () => {
    const p = calculatePValue(0.5, 20);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  it('returns same p-value for positive and negative r of same magnitude', () => {
    const pPos = calculatePValue(0.6, 15);
    const pNeg = calculatePValue(-0.6, 15);
    expect(pPos).toBeCloseTo(pNeg, 5);
  });
});

describe('classifyConfidence', () => {
  it('returns "high" when |r| >= 0.5, p < 0.01, n >= 14', () => {
    expect(classifyConfidence(0.7, 20, 0.005)).toBe('high');
    expect(classifyConfidence(-0.6, 14, 0.009)).toBe('high');
  });

  it('returns "moderate" when |r| >= 0.3, p < 0.05, n >= 10', () => {
    expect(classifyConfidence(0.4, 12, 0.04)).toBe('moderate');
    expect(classifyConfidence(-0.35, 10, 0.03)).toBe('moderate');
  });

  it('returns "suggestive" for weak or insufficiently sampled correlations', () => {
    expect(classifyConfidence(0.2, 8, 0.1)).toBe('suggestive');
    expect(classifyConfidence(0.4, 8, 0.04)).toBe('suggestive'); // n < 10
    expect(classifyConfidence(0.3, 15, 0.06)).toBe('suggestive'); // p >= 0.05
  });

  it('returns "suggestive" for negative r that is moderate but fails threshold', () => {
    expect(classifyConfidence(-0.2, 10, 0.1)).toBe('suggestive');
  });

  it('returns "moderate" not "high" when |r| is 0.5 but p >= 0.01', () => {
    expect(classifyConfidence(0.5, 14, 0.02)).toBe('moderate');
  });
});

describe('linearRegression', () => {
  it('returns zero slope and first y value for single-element arrays', () => {
    const result = linearRegression([0], [42]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(42);
  });

  it('returns zero slope when all x values are equal', () => {
    const result = linearRegression([3, 3, 3], [1, 2, 3]);
    expect(result.slope).toBe(0);
  });

  it('fits a perfect linear relationship', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [1, 3, 5, 7, 9]; // y = 2x + 1
    const result = linearRegression(xs, ys);
    expect(result.slope).toBeCloseTo(2, 5);
    expect(result.intercept).toBeCloseTo(1, 5);
    expect(result.r2).toBeCloseTo(1, 5);
  });

  it('fits a perfect negative relationship', () => {
    const xs = [0, 1, 2, 3];
    const ys = [10, 7, 4, 1]; // y = -3x + 10
    const result = linearRegression(xs, ys);
    expect(result.slope).toBeCloseTo(-3, 5);
    expect(result.intercept).toBeCloseTo(10, 5);
    expect(result.r2).toBeCloseTo(1, 5);
  });

  it('returns r2 between 0 and 1 for noisy data', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [2.1, 3.9, 6.2, 7.8, 10.3];
    const result = linearRegression(xs, ys);
    expect(result.r2).toBeGreaterThan(0.9);
    expect(result.r2).toBeLessThanOrEqual(1);
  });
});

describe('projectForward', () => {
  it('returns empty array for fewer than 2 data points', () => {
    expect(projectForward([{ date: '2026-01-01', value: 70 }], 7)).toEqual([]);
    expect(projectForward([], 7)).toEqual([]);
  });

  it('returns the correct number of projected days', () => {
    const data = [
      { date: '2026-01-01', value: 70 },
      { date: '2026-01-02', value: 71 },
      { date: '2026-01-03', value: 72 },
    ];
    const result = projectForward(data, 7);
    expect(result).toHaveLength(7);
  });

  it('projects dates sequentially starting from the day after the last data point', () => {
    const data = [
      { date: '2026-01-01', value: 70 },
      { date: '2026-01-02', value: 71 },
    ];
    const result = projectForward(data, 3);
    expect(result[0].date).toBe('2026-01-03');
    expect(result[1].date).toBe('2026-01-04');
    expect(result[2].date).toBe('2026-01-05');
  });

  it('projects values along a trend line', () => {
    // Perfect upward trend: +1 per day
    const data = [
      { date: '2026-01-01', value: 70 },
      { date: '2026-01-02', value: 71 },
      { date: '2026-01-03', value: 72 },
      { date: '2026-01-04', value: 73 },
      { date: '2026-01-05', value: 74 },
    ];
    const result = projectForward(data, 3);
    expect(result[0].value).toBeCloseTo(75, 1);
    expect(result[1].value).toBeCloseTo(76, 1);
    expect(result[2].value).toBeCloseTo(77, 1);
  });

  it('confidence interval widens with distance', () => {
    const data = [
      { date: '2026-01-01', value: 70 },
      { date: '2026-01-02', value: 72 },
      { date: '2026-01-03', value: 71 },
      { date: '2026-01-04', value: 73 },
      { date: '2026-01-05', value: 74 },
    ];
    const result = projectForward(data, 5);
    // Width of interval should increase with days ahead
    const width1 = result[0].high - result[0].low;
    const width5 = result[4].high - result[4].low;
    expect(width5).toBeGreaterThan(width1);
  });

  it('low is always less than value and high is always greater than value', () => {
    const data = [
      { date: '2026-01-01', value: 80 },
      { date: '2026-01-02', value: 79 },
      { date: '2026-01-03', value: 78 },
      { date: '2026-01-04', value: 77 },
      { date: '2026-01-05', value: 76 },
    ];
    const result = projectForward(data, 7);
    for (const point of result) {
      // When residuals are 0 (perfect line), CI may be 0 — allow equality
      expect(point.low).toBeLessThanOrEqual(point.value);
      expect(point.high).toBeGreaterThanOrEqual(point.value);
    }
  });
});
