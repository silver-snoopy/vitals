import type { AIProvider } from '@vitals/shared';
import type { EnvConfig } from '../../config/env.js';
import { ClaudeProvider } from './claude-provider.js';

export function createAIProvider(env: EnvConfig): AIProvider {
  const provider = env.aiProvider || 'claude';

  if (provider === 'claude') {
    if (!env.anthropicApiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is required when AI_PROVIDER is "claude". ' +
        'Set it in your environment variables.',
      );
    }
    return new ClaudeProvider({
      apiKey: env.anthropicApiKey,
      model: 'claude-sonnet-4-20250514',
    });
  }

  throw new Error(
    `Unknown AI provider: "${provider}". ` +
    'Supported providers: "claude". ' +
    'Set AI_PROVIDER in your environment variables.',
  );
}
