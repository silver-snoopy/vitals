import { describe, it, expect, vi } from 'vitest';
import { createAIProvider } from '../ai-service.js';
import type { EnvConfig } from '../../../config/env.js';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

const baseEnv: EnvConfig = {
  port: 3001,
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  aiProvider: 'claude',
  anthropicApiKey: 'test-api-key',
  n8nApiKey: '',
  dbDefaultUserId: '00000000-0000-0000-0000-000000000001',
  nodeEnv: 'test',
  cronometerUsername: '',
  cronometerPassword: '',
  cronometerGwtHeader: '',
  cronometerGwtPermutation: '',
  hevyApiKey: '',
  hevyApiBase: 'https://api.hevyapp.com/v1',
};

describe('createAIProvider', () => {
  it('returns ClaudeProvider when aiProvider is "claude"', () => {
    const provider = createAIProvider(baseEnv);
    expect(provider.name()).toBe('claude');
  });

  it('throws when anthropicApiKey is empty for claude provider', () => {
    expect(() =>
      createAIProvider({ ...baseEnv, anthropicApiKey: '' }),
    ).toThrow('ANTHROPIC_API_KEY is required');
  });

  it('throws for unknown AI provider', () => {
    expect(() =>
      createAIProvider({ ...baseEnv, aiProvider: 'openai' }),
    ).toThrow('Unknown AI provider');
  });

  it('error message includes the unknown provider name', () => {
    expect(() =>
      createAIProvider({ ...baseEnv, aiProvider: 'gemini' }),
    ).toThrow('gemini');
  });

  it('error message includes list of supported providers', () => {
    expect(() =>
      createAIProvider({ ...baseEnv, aiProvider: 'unknown' }),
    ).toThrow('claude');
  });
});
