import type { ConfidenceLevel } from '@vitals/shared';

/**
 * Computes the Pearson correlation coefficient between two equal-length arrays.
 * Returns NaN if the arrays have fewer than 2 elements or zero variance.
 */
export function pearsonCorrelation(xs: number[], ys: number[]): number {
  // TODO: implement Pearson r = cov(X,Y) / (stddev(X) * stddev(Y))
  void xs;
  void ys;
  throw new Error('Not implemented');
}

/**
 * Approximates the two-tailed p-value for a Pearson r given sample size n.
 * Uses t-distribution approximation: t = r * sqrt(n-2) / sqrt(1-r^2)
 */
export function calculatePValue(r: number, n: number): number {
  // TODO: compute t-statistic and approximate p-value via Student's t CDF
  void r;
  void n;
  throw new Error('Not implemented');
}

/**
 * Classifies the statistical confidence of a correlation.
 * high: |r| >= 0.5 AND p < 0.05 AND n >= 20
 * moderate: |r| >= 0.3 AND p < 0.1 AND n >= 10
 * suggestive: otherwise (above minimum threshold)
 */
export function classifyConfidence(r: number, n: number, pValue: number): ConfidenceLevel {
  // TODO: apply thresholds to return 'high' | 'moderate' | 'suggestive'
  void r;
  void n;
  void pValue;
  throw new Error('Not implemented');
}

/**
 * Fits a simple linear regression y = slope * x + intercept to the data.
 * x values are numeric indices (0, 1, 2, ...) derived from the data order.
 * Returns slope, intercept, and coefficient of determination (r²).
 */
export function linearRegression(
  xs: number[],
  ys: number[],
): { slope: number; intercept: number; r2: number } {
  // TODO: ordinary least squares via sum of squares
  void xs;
  void ys;
  throw new Error('Not implemented');
}

/**
 * Projects future values forward from a time series using linear regression.
 * Returns an array of { date, value, low, high } objects for the next daysForward days.
 * confidence interval width is ±1 standard error of regression residuals.
 */
export function projectForward(
  data: { date: string; value: number }[],
  daysForward: number,
): Array<{ date: string; value: number; low: number; high: number }> {
  // TODO: fit linearRegression, extrapolate dates, compute residual std dev for CI
  void data;
  void daysForward;
  throw new Error('Not implemented');
}
