import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import type { EnvConfig } from '../../config/env.js';

vi.mock('../../plugins/database.js', () => ({
  databasePlugin: async (app: { decorate: (k: string, v: unknown) => void }) => {
    app.decorate('db', {});
  },
}));

vi.mock('../../services/collectors/register.js', () => ({
  registerProviders: vi.fn(),
}));

// Mock conversation queries so tests don't hit the DB
vi.mock('../../db/queries/conversations.js', () => ({
  createConversation: vi.fn().mockResolvedValue({ id: 'conv-1', title: null, userId: 'default', createdAt: new Date(), updatedAt: new Date() }),
  getConversation: vi.fn().mockResolvedValue({ id: 'conv-1', title: null, userId: 'default', createdAt: new Date(), updatedAt: new Date() }),
  listConversations: vi.fn().mockResolvedValue([]),
  getMessages: vi.fn().mockResolvedValue([]),
  addMessage: vi.fn().mockResolvedValue(undefined),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
  updateConversationTitle: vi.fn().mockResolvedValue(undefined),
}));

// Mock the AI chat function to avoid needing a real API key
vi.mock('../../services/ai/conversation-service.js', () => ({
  chat: vi.fn().mockResolvedValue({
    response: 'Your protein intake was 150g.',
    toolCalls: [],
    tokensUsed: 100,
  }),
  chatStream: vi.fn(),
}));

const testEnv: EnvConfig = {
  port: 3001,
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  aiProvider: 'claude' as const,
  aiApiKey: 'test-key',
  xApiKey: '',
  dbDefaultUserId: '00000000-0000-0000-0000-000000000001',
  nodeEnv: 'test',
  cronometerUsername: '',
  cronometerPassword: '',
  cronometerGwtHeader: '',
  cronometerGwtPermutation: '',
  hevyApiKey: '',
  hevyApiBase: 'https://api.hevyapp.com/v1',
  frontendUrl: '',
};

describe('POST /api/chat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when message is missing', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when message is empty string', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { message: '   ' },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when message exceeds 4000 characters', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { message: 'x'.repeat(4001) },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 404 when conversationId does not exist', async () => {
    const { getConversation } = await import('../../db/queries/conversations.js');
    (getConversation as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { message: 'Hello', conversationId: 'nonexistent' },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 200 with response and creates a new conversation', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { message: 'What was my protein intake?' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ conversationId: string; response: string }>();
    expect(body.conversationId).toBe('conv-1');
    expect(body.response).toContain('150g');
    await app.close();
  });
});

describe('GET /api/chat/conversations', () => {
  it('returns empty array when no conversations exist', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/chat/conversations',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ conversations: unknown[] }>();
    expect(body.conversations).toHaveLength(0);
    await app.close();
  });
});

describe('GET /api/chat/conversations/:id', () => {
  it('returns 404 when conversation does not exist', async () => {
    const { getConversation } = await import('../../db/queries/conversations.js');
    (getConversation as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/chat/conversations/nonexistent',
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 200 with conversation and messages', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'GET',
      url: '/api/chat/conversations/conv-1',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ conversation: unknown; messages: unknown[] }>();
    expect(body.conversation).toBeDefined();
    expect(Array.isArray(body.messages)).toBe(true);
    await app.close();
  });
});

describe('DELETE /api/chat/conversations/:id', () => {
  it('returns 404 when conversation does not exist', async () => {
    const { getConversation } = await import('../../db/queries/conversations.js');
    (getConversation as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/chat/conversations/nonexistent',
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 204 on successful delete', async () => {
    const app = await buildApp(testEnv);
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/chat/conversations/conv-1',
    });
    expect(response.statusCode).toBe(204);
    await app.close();
  });
});
