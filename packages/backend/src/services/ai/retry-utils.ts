import type { AIProvider } from '@vitals/shared';

/**
 * Retries an AI provider call with exponential backoff on 429 rate-limit errors.
 * Shared between report-generator and plan-tuner (extracted from both to eliminate duplication).
 */
export async function completeWithRetry(
  aiProvider: AIProvider,
  messages: Parameters<AIProvider['complete']>[0],
  maxRetries = 3,
): ReturnType<AIProvider['complete']> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await aiProvider.complete(messages);
    } catch (err: unknown) {
      const isRateLimit =
        (err instanceof Error && /429|rate.limit|too many requests/i.test(err.message)) ||
        (typeof err === 'object' &&
          err !== null &&
          'status' in err &&
          (err as { status: number }).status === 429);

      if (!isRateLimit || attempt === maxRetries) throw err;

      const delay = Math.min(1000 * 2 ** attempt, 30_000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}
