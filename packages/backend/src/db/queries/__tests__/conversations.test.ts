import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createConversation,
  getConversation,
  listConversations,
  addMessage,
  getMessages,
  deleteConversation,
  updateConversationTitle,
} from '../conversations.js';
import type pg from 'pg';

function makePool(rows: unknown[]): pg.Pool {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as pg.Pool;
}

const fakeConvRow = {
  id: 'uuid-1',
  user_id: 'default',
  title: 'My chat',
  created_at: new Date('2026-03-01'),
  updated_at: new Date('2026-03-01'),
};

const fakeMsgRow = {
  id: 'msg-1',
  conversation_id: 'uuid-1',
  role: 'user',
  content: 'Hello',
  tool_calls: null,
  tool_name: null,
  tool_call_id: null,
  tokens_used: null,
  created_at: new Date('2026-03-01'),
};

describe('conversation queries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getConversation returns null when no rows returned', async () => {
    const pool = makePool([]);
    const result = await getConversation(pool, 'uuid-nonexistent');
    expect(result).toBeNull();
  });

  it('getConversation returns mapped row when found', async () => {
    const pool = makePool([fakeConvRow]);
    const result = await getConversation(pool, 'uuid-1');
    expect(result?.id).toBe('uuid-1');
    expect(result?.title).toBe('My chat');
  });

  it('createConversation inserts and returns mapped row', async () => {
    const pool = makePool([fakeConvRow]);
    const result = await createConversation(pool, 'default', 'My chat');
    expect(result.id).toBe('uuid-1');
    expect(result.title).toBe('My chat');
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls[0][1]).toContain('default');
  });

  it('listConversations returns array', async () => {
    const pool = makePool([fakeConvRow]);
    const result = await listConversations(pool, 'default');
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('default');
  });

  it('addMessage calls pool with correct params and bumps conversation', async () => {
    const pool = makePool([fakeMsgRow]);
    await addMessage(pool, {
      conversationId: 'uuid-1',
      role: 'user',
      content: 'Hello',
      toolCalls: null,
      toolName: null,
      toolCallId: null,
      tokensUsed: null,
    });
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2); // INSERT + UPDATE
  });

  it('getMessages returns mapped array', async () => {
    const pool = makePool([fakeMsgRow]);
    const result = await getMessages(pool, 'uuid-1');
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('Hello');
  });

  it('deleteConversation calls DELETE', async () => {
    const pool = makePool([]);
    await deleteConversation(pool, 'uuid-1');
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatch(/DELETE/);
  });

  it('updateConversationTitle calls UPDATE', async () => {
    const pool = makePool([]);
    await updateConversationTitle(pool, 'uuid-1', 'New title');
    const [sql, params] = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      unknown[],
    ];
    expect(sql).toMatch(/UPDATE/);
    expect(params).toContain('New title');
  });
});
