import { describe, it, expect } from 'vitest';
import { determineOutcome, determineConfidence } from '../outcome-measurer.js';

describe('determineOutcome', () => {
  it('returns improved when increase direction and value went up', () => {
    expect(determineOutcome(100, 110, 'increase')).toBe('improved');
  });

  it('returns declined when increase direction and value went down', () => {
    expect(determineOutcome(100, 95, 'increase')).toBe('declined');
  });

  it('returns stable when increase direction and minimal change', () => {
    expect(determineOutcome(100, 101, 'increase')).toBe('stable');
  });

  it('returns improved when decrease direction and value went down', () => {
    expect(determineOutcome(100, 90, 'decrease')).toBe('improved');
  });

  it('returns declined when decrease direction and value went up', () => {
    expect(determineOutcome(100, 110, 'decrease')).toBe('declined');
  });

  it('returns stable when decrease direction and minimal change', () => {
    expect(determineOutcome(100, 99, 'decrease')).toBe('stable');
  });

  it('returns improved when maintain direction and value is within 5%', () => {
    expect(determineOutcome(100, 103, 'maintain')).toBe('improved');
  });

  it('returns declined when maintain direction and value moved >5%', () => {
    expect(determineOutcome(100, 106, 'maintain')).toBe('declined');
  });

  it('returns stable when baseline is 0', () => {
    expect(determineOutcome(0, 50, 'increase')).toBe('stable');
  });
});

describe('determineConfidence', () => {
  it('returns low when fewer than 3 data points', () => {
    expect(determineConfidence(100, 120, 2)).toBe('low');
  });

  it('returns high when >10% change and >=5 data points', () => {
    expect(determineConfidence(100, 115, 7)).toBe('high');
  });

  it('returns medium when 2-10% change', () => {
    expect(determineConfidence(100, 105, 4)).toBe('medium');
  });

  it('returns medium when >=3 data points but small change', () => {
    expect(determineConfidence(100, 101, 3)).toBe('medium');
  });

  it('returns low when baseline is 0 and few data points', () => {
    expect(determineConfidence(0, 50, 1)).toBe('low');
  });
});
