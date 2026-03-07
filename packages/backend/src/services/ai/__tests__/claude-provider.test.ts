import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeProvider } from '../claude-provider.js';

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'The AI response.' }],
    model: 'claude-sonnet-4-20250514',
    usage: { input_tokens: 100, output_tokens: 50 },
  });

  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider;

  beforeEach(() => {
    provider = new ClaudeProvider({ apiKey: 'test-key', model: 'claude-sonnet-4-20250514' });
  });

  it('name() returns "claude"', () => {
    expect(provider.name()).toBe('claude');
  });

  it('maps response content and usage to AICompletionResult', async () => {
    const result = await provider.complete([
      { role: 'user', content: 'Hello' },
    ]);

    expect(result.content).toBe('The AI response.');
    expect(result.model).toBe('claude-sonnet-4-20250514');
    expect(result.usage.promptTokens).toBe(100);
    expect(result.usage.completionTokens).toBe(50);
    expect(result.usage.totalTokens).toBe(150);
  });

  it('extracts system message and passes as top-level param', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const instance = (Anthropic as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    const mockCreate = instance.messages.create as ReturnType<typeof vi.fn>;
    mockCreate.mockClear();

    await provider.complete([
      { role: 'system', content: 'You are a health analyst.' },
      { role: 'user', content: 'Analyze my data.' },
    ]);

    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toBe('You are a health analyst.');
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].role).toBe('user');
  });

  it('handles messages without a system prompt', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const instance = (Anthropic as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    const mockCreate = instance.messages.create as ReturnType<typeof vi.fn>;
    mockCreate.mockClear();

    await provider.complete([{ role: 'user', content: 'Hello' }]);

    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toBeUndefined();
  });

  it('accepts config overrides for model and maxTokens', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const instance = (Anthropic as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    const mockCreate = instance.messages.create as ReturnType<typeof vi.fn>;
    mockCreate.mockClear();

    await provider.complete(
      [{ role: 'user', content: 'Hi' }],
      { model: 'claude-opus-4-6', maxTokens: 1024 },
    );

    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe('claude-opus-4-6');
    expect(call.max_tokens).toBe(1024);
  });
});
