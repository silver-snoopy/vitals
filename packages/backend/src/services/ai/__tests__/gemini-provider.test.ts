import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from '../gemini-provider.js';

const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({ generateContent: mockGenerateContent }));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe('GeminiProvider', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GeminiProvider({ apiKey: 'test-key' });
  });

  it('name() returns "gemini"', () => {
    expect(provider.name()).toBe('gemini');
  });

  it('throws when no user messages provided', async () => {
    await expect(
      provider.complete([{ role: 'system', content: 'You are an analyst.' }]),
    ).rejects.toThrow('At least one user message is required.');
  });

  it('passes system message as systemInstruction', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'result',
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      },
    });

    await provider.complete([
      { role: 'system', content: 'You are a health analyst.' },
      { role: 'user', content: 'Summarize my week.' },
    ]);

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ systemInstruction: 'You are a health analyst.' }),
    );
  });

  it('maps assistant role to "model" in contents', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'follow-up answer',
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 },
      },
    });

    await provider.complete([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ]);

    expect(mockGenerateContent).toHaveBeenCalledWith({
      contents: [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi there!' }] },
        { role: 'user', parts: [{ text: 'How are you?' }] },
      ],
    });
  });

  it('returns content and mapped usage stats', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'The analysis is complete.',
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
      },
    });

    const result = await provider.complete([{ role: 'user', content: 'Analyze this.' }]);

    expect(result.content).toBe('The analysis is complete.');
    expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
  });

  it('handles missing usageMetadata gracefully', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'ok', usageMetadata: undefined },
    });

    const result = await provider.complete([{ role: 'user', content: 'test' }]);
    expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('uses default model when none specified', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '', usageMetadata: undefined },
    });

    await provider.complete([{ role: 'user', content: 'test' }]);

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.0-flash' }),
    );
  });

  it('uses override model from complete() config', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '', usageMetadata: undefined },
    });

    await provider.complete([{ role: 'user', content: 'test' }], { model: 'gemini-1.5-pro' });

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-1.5-pro' }),
    );
  });
});
