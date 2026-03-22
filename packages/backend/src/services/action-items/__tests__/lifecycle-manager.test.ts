import { describe, it, expect } from 'vitest';
import { keywordOverlap } from '../lifecycle-manager.js';

describe('keywordOverlap', () => {
  it('returns 1.0 for identical strings', () => {
    expect(keywordOverlap('increase protein intake daily', 'increase protein intake daily')).toBe(
      1,
    );
  });

  it('returns high overlap for similar action items', () => {
    const overlap = keywordOverlap(
      'Increase protein to 150g per day',
      'Increase daily protein intake to 160g',
    );
    expect(overlap).toBeGreaterThanOrEqual(0.4);
  });

  it('returns low overlap for different action items', () => {
    const overlap = keywordOverlap(
      'Increase protein to 150g per day',
      'Add a deload week for recovery',
    );
    expect(overlap).toBeLessThan(0.3);
  });

  it('returns 0 for empty strings', () => {
    expect(keywordOverlap('', 'some text')).toBe(0);
    expect(keywordOverlap('some text', '')).toBe(0);
  });

  it('ignores short words (<=2 chars)', () => {
    // "a" and "to" are filtered out
    const overlap = keywordOverlap('a to be', 'a to be');
    expect(overlap).toBe(0); // all words are <= 2 chars
  });

  it('is case-insensitive', () => {
    expect(keywordOverlap('Increase Protein', 'increase protein')).toBe(1);
  });

  it('ignores punctuation', () => {
    expect(keywordOverlap('protein: 150g/day!', 'protein 150g day')).toBeGreaterThanOrEqual(0.5);
  });
});
