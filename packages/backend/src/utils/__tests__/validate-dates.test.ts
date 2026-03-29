import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDefaultDateRange, validateDateRange, isDateRangeError } from '../validate-dates.js';

describe('getDefaultDateRange', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns end as yesterday (midnight)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T15:00:00.000Z'));

    const { end } = getDefaultDateRange();
    expect(end.toISOString().split('T')[0]).toBe('2026-03-28');
  });

  it('returns start as 6 days before end (7-day window)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T15:00:00.000Z'));

    const { start, end } = getDefaultDateRange();
    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(6);
    expect(start.toISOString().split('T')[0]).toBe('2026-03-22');
  });

  it('does not include today', () => {
    vi.useFakeTimers();
    const now = new Date('2026-03-29T12:00:00.000Z');
    vi.setSystemTime(now);

    const { end } = getDefaultDateRange();
    expect(end.toISOString().split('T')[0]).not.toBe('2026-03-29');
  });
});

describe('validateDateRange', () => {
  it('returns error when both dates are missing', () => {
    const result = validateDateRange();
    expect(isDateRangeError(result)).toBe(true);
  });

  it('returns error when only startDate is provided', () => {
    const result = validateDateRange('2026-03-01', undefined);
    expect(isDateRangeError(result)).toBe(true);
  });

  it('returns error when only endDate is provided', () => {
    const result = validateDateRange(undefined, '2026-03-07');
    expect(isDateRangeError(result)).toBe(true);
  });

  it('returns error when start is after end', () => {
    const result = validateDateRange('2026-03-07', '2026-03-01');
    expect(isDateRangeError(result)).toBe(true);
  });

  it('returns valid range with Date objects', () => {
    const result = validateDateRange('2026-03-01', '2026-03-07');
    expect(isDateRangeError(result)).toBe(false);
    if (!isDateRangeError(result)) {
      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
    }
  });
});
