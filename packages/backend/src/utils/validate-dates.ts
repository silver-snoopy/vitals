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

export function isDateRangeError(
  result: ValidDateRange | DateRangeError,
): result is DateRangeError {
  return 'error' in result;
}
