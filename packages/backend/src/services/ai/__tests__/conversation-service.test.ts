import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chat, chatStream } from '../conversation-service.js';
import type { AIProvider, AIMessage, AIToolCompletionResult, AIStreamChunk } from '@vitals/shared';
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
    completeWithTools: vi
      .fn()
      .mockImplementation(async () => responses[call++] ?? responses[responses.length - 1]),
    stream: vi.fn(),
  };
}

function makeStreamingProvider(chunkSets: AIStreamChunk[][]): AIProvider {
  let call = 0;
  return {
    name: () => 'mock',
    complete: vi.fn(),
    completeWithTools: vi.fn(),
    stream: vi.fn().mockImplementation(async function* () {
      const chunks = chunkSets[call++] ?? chunkSets[chunkSets.length - 1];
      for (const chunk of chunks) {
        yield chunk;
      }
    }),
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
  toolCalls: [
    {
      id: 'tc-1',
      name: 'query_nutrition',
      input: { startDate: '2026-03-01', endDate: '2026-03-07' },
    },
  ],
  stopReason: 'tool_use',
};

// Streaming chunk sets
const textOnlyChunks: AIStreamChunk[] = [
  { type: 'text', text: 'Your protein was ' },
  { type: 'text', text: '150g per day.' },
  { type: 'done' },
];

const toolCallChunks: AIStreamChunk[] = [
  {
    type: 'tool_call_start',
    toolCall: {
      id: 'tc-stream-1',
      name: 'query_nutrition',
      input: { startDate: '2026-03-01', endDate: '2026-03-07' },
    },
  },
  { type: 'done' },
];

const textAfterToolChunks: AIStreamChunk[] = [
  { type: 'text', text: 'Based on the data, your protein was 150g.' },
  { type: 'done' },
];

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

  it('respects max iteration limit (exactly 10 calls)', async () => {
    const provider = makeProvider(Array(11).fill(toolUseResponse));
    const result = await chat(provider, mockDb, 'default', 'Loop forever', []);
    expect(result.response).toBeTruthy();
    expect((provider.completeWithTools as ReturnType<typeof vi.fn>).mock.calls.length).toBe(10);
  });

  it('passes conversation history to provider', async () => {
    const provider = makeProvider([endTurnResponse]);
    const history: AIMessage[] = [
      { role: 'user', content: 'Previous question' },
      { role: 'assistant', content: 'Previous answer' },
    ];
    await chat(provider, mockDb, 'default', 'Follow-up', history);
    const callArgs = (provider.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0] as [
      AIMessage[],
      unknown,
    ];
    const messages = callArgs[0];
    expect(messages.some((m) => m.content === 'Previous question')).toBe(true);
    expect(messages.some((m) => m.content === 'Follow-up')).toBe(true);
  });
});

describe('chatStream', () => {
  beforeEach(() => vi.clearAllMocks());

  it('streams text chunks directly when no tool calls', async () => {
    const provider = makeStreamingProvider([textOnlyChunks]);
    const chunks: AIStreamChunk[] = [];
    for await (const chunk of chatStream(provider, mockDb, 'default', 'What is my protein?', [])) {
      chunks.push(chunk);
    }
    const textChunks = chunks.filter((c) => c.type === 'text');
    expect(textChunks.map((c) => c.text).join('')).toContain('150g');
    expect(chunks.some((c) => c.type === 'done')).toBe(true);
  });

  it('executes tool calls and streams final text response', async () => {
    const { executeTool } = await import('../tools/tool-executor.js');
    (executeTool as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({ protein: 150 }));

    const provider = makeStreamingProvider([toolCallChunks, textAfterToolChunks]);
    const chunks: AIStreamChunk[] = [];

    for await (const chunk of chatStream(provider, mockDb, 'default', 'What is my protein?', [])) {
      chunks.push(chunk);
    }

    // Tool call badge chunk should be yielded for UI transparency
    expect(chunks.some((c) => c.type === 'tool_call_start')).toBe(true);
    // Final text should be yielded
    const textChunks = chunks.filter((c) => c.type === 'text');
    expect(textChunks.length).toBeGreaterThan(0);
    expect(chunks.some((c) => c.type === 'done')).toBe(true);
  });

  it('invokes onToolCall callback for each tool call', async () => {
    const { executeTool } = await import('../tools/tool-executor.js');
    (executeTool as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({ protein: 150 }));

    const provider = makeStreamingProvider([toolCallChunks, textAfterToolChunks]);
    const onToolCall = vi.fn();

    for await (const _ of chatStream(
      provider,
      mockDb,
      'default',
      'What is my protein?',
      [],
      onToolCall,
    )) {
      // consume
    }

    expect(onToolCall).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'query_nutrition' }),
    );
  });

  it('yields max-iteration fallback text and done when loop limit reached', async () => {
    // Each stream always returns tool calls — should exhaust MAX_ITERATIONS
    const infiniteToolChunks: AIStreamChunk[] = [
      {
        type: 'tool_call_start',
        toolCall: {
          id: 'tc-inf',
          name: 'query_nutrition',
          input: { startDate: '2026-03-01', endDate: '2026-03-07' },
        },
      },
      { type: 'done' },
    ];

    const { executeTool } = await import('../tools/tool-executor.js');
    (executeTool as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({ protein: 150 }));

    const provider = makeStreamingProvider(Array(11).fill(infiniteToolChunks));
    const chunks: AIStreamChunk[] = [];

    for await (const chunk of chatStream(provider, mockDb, 'default', 'Loop forever', [])) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === 'text');
    expect(textChunks.some((c) => c.text?.includes('maximum'))).toBe(true);
    expect(chunks.some((c) => c.type === 'done')).toBe(true);
  });
});
