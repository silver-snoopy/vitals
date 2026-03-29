export interface ValidDateRange {
  start: Date;
  end: Date;
}

export interface DateRangeError {
  error: string;
}

export function validateDateRange(
  startDate?: string,
  endDate?: string,
): ValidDateRange | DateRangeError {
  if (!startDate || !endDate) {
    return { error: 'startDate and endDate are required' };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: 'startDate and endDate must be valid ISO date strings' };
  }

  if (start > end) {
    return { error: 'startDate must be before or equal to endDate' };
  }

  return { start, end };
}

/**
 * Returns a 7-day window ending yesterday (today excluded).
 * end = yesterday UTC, start = yesterday − 6 days UTC.
 * Uses UTC arithmetic so results are timezone-independent.
 */
export function getDefaultDateRange(): ValidDateRange {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  const end = new Date(Date.UTC(y, m, d - 1));
  const start = new Date(Date.UTC(y, m, d - 7));

  return { start, end };
}

export function isDateRangeError(
  result: ValidDateRange | DateRangeError,
): result is DateRangeError {
  return 'error' in result;
}
