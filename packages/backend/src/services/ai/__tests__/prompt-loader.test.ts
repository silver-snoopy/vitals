import { describe, it, expect } from 'vitest';
import { persona, analysisProtocol, outputFormat } from '../prompt-loader.js';

describe('prompt-loader', () => {
  it('loads persona as a non-empty string', () => {
    expect(typeof persona).toBe('string');
    expect(persona.length).toBeGreaterThan(100);
    expect(persona).toContain('sports-science');
  });

  it('loads analysis protocol with all 5 steps', () => {
    expect(typeof analysisProtocol).toBe('string');
    expect(analysisProtocol).toContain('Step 1');
    expect(analysisProtocol).toContain('Step 5');
    expect(analysisProtocol).toContain('Energy Availability');
  });

  it('loads output format with JSON schema', () => {
    expect(typeof outputFormat).toBe('string');
    expect(outputFormat).toContain('biometricsOverview');
    expect(outputFormat).toContain('scorecard');
    expect(outputFormat).toContain('actionItems');
  });
});
