import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chat } from '../conversation-service.js';
import type { AIProvider, AIMessage, AIToolCompletionResult } from '@vitals/shared';
import type pg from 'pg';

vi.mock('../tools/tool-executor.js', () => ({
  executeTool: vi.fn().mockResolvedValue(JSON.stringify({ calories: 2100 })),
}));

const mockDb = {} as unknown as pg.Pool;

function makeProvider(responses: AIToolCompletionResult[]): AIProvider {
  let call = 0;
  return {
    name: () => 'mock',
    complete: vi.fn(),
    completeWithTools: vi.fn().mockImplementation(async () => responses[call++] ?? responses[responses.length - 1]),
    stream: vi.fn(),
  };
}

const endTurnResponse: AIToolCompletionResult = {
  content: 'Your average protein was 150g.',
  model: 'mock',
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  toolCalls: [],
  stopReason: 'end_turn',
};

const toolUseResponse: AIToolCompletionResult = {
  content: '',
  model: 'mock',
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  toolCalls: [{ id: 'tc-1', name: 'query_nutrition', input: { startDate: '2026-03-01', endDate: '2026-03-07' } }],
  stopReason: 'tool_use',
};

describe('chat conversation service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns text response on end_turn without tool calls', async () => {
    const provider = makeProvider([endTurnResponse]);
    const result = await chat(provider, mockDb, 'default', 'How is my diet?', []);
    expect(result.response).toBe('Your average protein was 150g.');
    expect(result.toolCalls).toHaveLength(0);
  });

  it('executes tool calls and loops until end_turn', async () => {
    const provider = makeProvider([toolUseResponse, endTurnResponse]);
    const result = await chat(provider, mockDb, 'default', 'What did I eat?', []);
    expect(result.response).toBe('Your average protein was 150g.');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].toolName).toBe('query_nutrition');
  });

  it('respects max iteration limit', async () => {
    // Always returns tool_use — should terminate after MAX_ITERATIONS
    const provider = makeProvider(Array(11).fill(toolUseResponse));
    const result = await chat(provider, mockDb, 'default', 'Loop forever', []);
    expect(result.response).toBeTruthy();
    expect((provider.completeWithTools as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(10);
  });

  it('passes conversation history to provider', async () => {
    const provider = makeProvider([endTurnResponse]);
    const history: AIMessage[] = [
      { role: 'user', content: 'Previous question' },
      { role: 'assistant', content: 'Previous answer' },
    ];
    await chat(provider, mockDb, 'default', 'Follow-up', history);
    const callArgs = (provider.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0] as [AIMessage[], unknown];
    const messages = callArgs[0];
    expect(messages.some((m) => m.content === 'Previous question')).toBe(true);
    expect(messages.some((m) => m.content === 'Follow-up')).toBe(true);
  });
});
