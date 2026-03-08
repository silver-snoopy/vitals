import type { AIProvider } from '@vitals/shared';
import type { EnvConfig } from '../../config/env.js';
import { ClaudeProvider } from './claude-provider.js';
import { GeminiProvider } from './gemini-provider.js';

export function createAIProvider(env: EnvConfig): AIProvider {
  const provider = env.aiProvider;

  if (!env.aiApiKey) {
    throw new Error('AI_API_KEY is required. Set it in your environment variables.');
  }

  if (provider === 'claude') {
    return new ClaudeProvider({ apiKey: env.aiApiKey });
  }

  if (provider === 'gemini') {
    return new GeminiProvider({ apiKey: env.aiApiKey });
  }

  throw new Error(
    `Unknown AI provider: "${provider}". ` +
      'Supported providers: "claude", "gemini". ' +
      'Set AI_PROVIDER in your environment variables.',
  );
}
