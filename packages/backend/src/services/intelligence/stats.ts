import type { ConfidenceLevel } from '@vitals/shared';

/**
 * Computes the Pearson correlation coefficient between two equal-length arrays.
 * Returns NaN if the arrays have fewer than 2 elements or zero variance.
 */
export function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return NaN;

  const meanX = xs.reduce((acc, x) => acc + x, 0) / n;
  const meanY = ys.reduce((acc, y) => acc + y, 0) / n;

  let covXY = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    covXY += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  if (varX === 0 || varY === 0) return NaN;

  return covXY / Math.sqrt(varX * varY);
}

/**
 * Approximates the two-tailed p-value for a Pearson r given sample size n.
 * Uses t-distribution approximation: t = r * sqrt(n-2) / sqrt(1-r^2)
 */
export function calculatePValue(r: number, n: number): number {
  if (n <= 2) return 1;
  if (isNaN(r)) return 1;

  // Clamp r to avoid sqrt of negative
  const rClamped = Math.max(-1 + 1e-10, Math.min(1 - 1e-10, r));
  const t = (rClamped * Math.sqrt(n - 2)) / Math.sqrt(1 - rClamped * rClamped);
  const df = n - 2;

  // Approximate two-tailed p-value using a numerical approximation of the t-distribution CDF.
  // We use the regularized incomplete beta function approximation.
  const x = df / (df + t * t);
  const p = incompleteBetaRegularized(df / 2, 0.5, x);

  return Math.min(1, Math.max(0, p));
}

/**
 * Regularized incomplete beta function I_x(a, b) approximated via continued fraction.
 * Used to compute the CDF of the t-distribution.
 */
function incompleteBetaRegularized(a: number, b: number, x: number): number {
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;

  // Use symmetry relation when x > (a+1)/(a+b+2)
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBetaRegularized(b, a, 1 - x);
  }

  const lbeta = logBeta(a, b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;

  // Continued fraction using Lentz's method
  const cf = continuedFraction(a, b, x);
  return front * cf;
}

function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function logGamma(z: number): number {
  // Lanczos approximation
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  }

  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function continuedFraction(a: number, b: number, x: number): number {
  const maxIter = 200;
  const eps = 3e-7;

  let h = 1;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  h = d;

  for (let m = 1; m <= maxIter; m++) {
    // Even step
    let numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d;
    c = 1 + numerator / c;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;

    // Odd step
    numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + numerator * d;
    c = 1 + numerator / c;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;

    if (Math.abs(delta - 1) < eps) break;
  }

  return h;
}

/**
 * Classifies the statistical confidence of a correlation.
 * high: |r| >= 0.5 AND p < 0.01 AND n >= 14
 * moderate: |r| >= 0.3 AND p < 0.05 AND n >= 10
 * suggestive: otherwise
 */
export function classifyConfidence(r: number, n: number, pValue: number): ConfidenceLevel {
  const absR = Math.abs(r);

  if (absR >= 0.5 && pValue < 0.01 && n >= 14) {
    return 'high';
  }
  if (absR >= 0.3 && pValue < 0.05 && n >= 10) {
    return 'moderate';
  }
  return 'suggestive';
}

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  /** Mean of the x values — used for proper OLS prediction intervals. */
  meanX: number;
  /** Sum of squared deviations of x: Σ(xᵢ − meanX)² — used for prediction intervals. */
  ssXX: number;
}

/**
 * Fits a simple linear regression y = slope * x + intercept to the data.
 * x values are numeric indices (0, 1, 2, ...) derived from the data order.
 * Returns slope, intercept, coefficient of determination (r²), meanX, and ssXX
 * for use in proper OLS prediction interval calculation.
 */
export function linearRegression(xs: number[], ys: number[]): LinearRegressionResult {
  const n = xs.length;
  if (n < 2 || n !== ys.length) {
    return { slope: 0, intercept: ys[0] ?? 0, r2: 0, meanX: xs[0] ?? 0, ssXX: 0 };
  }

  const meanX = xs.reduce((acc, x) => acc + x, 0) / n;
  const meanY = ys.reduce((acc, y) => acc + y, 0) / n;

  let ssXY = 0;
  let ssXX = 0;

  for (let i = 0; i < n; i++) {
    ssXY += (xs[i] - meanX) * (ys[i] - meanY);
    ssXX += (xs[i] - meanX) * (xs[i] - meanX);
  }

  if (ssXX === 0) {
    return { slope: 0, intercept: meanY, r2: 0, meanX, ssXX: 0 };
  }

  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;

  // Compute r² = 1 - SSres/SStot
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (ys[i] - meanY) ** 2;
    ssRes += (ys[i] - (slope * xs[i] + intercept)) ** 2;
  }

  // M-L1: when all y-values are identical (ssTot === 0), r² is 0 (no variance to explain)
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, r2, meanX, ssXX };
}

/**
 * Projects future values forward from a time series using linear regression.
 * Returns an array of { date, value, low, high } objects for the next daysForward days.
 * Confidence interval uses the proper OLS prediction interval formula:
 *   CI(x*) = residualStdDev * sqrt(1 + 1/n + (x* - meanX)² / ssXX)
 */
export function projectForward(
  data: { date: string; value: number }[],
  daysForward: number,
): Array<{ date: string; value: number; low: number; high: number }> {
  if (data.length < 2) return [];

  const xs = data.map((_, i) => i);
  const ys = data.map((d) => d.value);
  const n = xs.length;

  const { slope, intercept, meanX, ssXX } = linearRegression(xs, ys);

  // Compute residual standard deviation
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (ys[i] - (slope * xs[i] + intercept)) ** 2;
  }
  const residualStdDev = Math.sqrt(ssRes / Math.max(1, n - 2));

  // Parse the last date
  const lastDate = new Date(data[data.length - 1].date);
  const lastX = xs[xs.length - 1];

  const results: Array<{ date: string; value: number; low: number; high: number }> = [];

  for (let d = 1; d <= daysForward; d++) {
    const futureX = lastX + d;
    const projectedValue = slope * futureX + intercept;

    // Proper OLS prediction interval: widens with distance from meanX
    const leverage = ssXX > 0 ? (futureX - meanX) ** 2 / ssXX : 0;
    const ci = residualStdDev * Math.sqrt(1 + 1 / n + leverage);

    const projDate = new Date(lastDate);
    projDate.setDate(projDate.getDate() + d);
    const dateStr = projDate.toISOString().split('T')[0];

    results.push({
      date: dateStr,
      value: projectedValue,
      low: projectedValue - ci,
      high: projectedValue + ci,
    });
  }

  return results;
}
