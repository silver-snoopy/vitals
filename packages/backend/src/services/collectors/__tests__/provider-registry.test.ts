import { describe, it, expect, beforeEach } from 'vitest';
import { registry } from '../provider-registry.js';
import type { DataProvider, CollectionResult } from '@vitals/shared';

function makeProvider(name: string): DataProvider {
  return {
    name,
    collect: async (): Promise<CollectionResult> => ({
      provider: name,
      recordCount: 0,
      dateRange: { start: new Date(), end: new Date() },
      errors: [],
    }),
  };
}

describe('ProviderRegistry', () => {
  beforeEach(() => {
    registry.clear();
  });

  it('registers and retrieves a provider by name', () => {
    const p = makeProvider('hevy');
    registry.register(p);
    expect(registry.get('hevy')).toBe(p);
  });

  it('returns undefined for unknown provider', () => {
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('getAll returns all registered providers', () => {
    registry.register(makeProvider('hevy'));
    registry.register(makeProvider('cronometer-nutrition'));
    expect(registry.getAll()).toHaveLength(2);
  });

  it('names returns all registered provider names', () => {
    registry.register(makeProvider('hevy'));
    registry.register(makeProvider('cronometer-biometrics'));
    expect(registry.names()).toEqual(['hevy', 'cronometer-biometrics']);
  });

  it('overwrites provider when registered with same name', () => {
    const p1 = makeProvider('hevy');
    const p2 = makeProvider('hevy');
    registry.register(p1);
    registry.register(p2);
    expect(registry.get('hevy')).toBe(p2);
    expect(registry.getAll()).toHaveLength(1);
  });
});
