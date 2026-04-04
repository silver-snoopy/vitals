import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import { apiKeyMiddleware } from '../middleware/api-key.js';
import { createAIProvider } from '../services/ai/ai-service.js';
import { chat } from '../services/ai/conversation-service.js';
import {
  createConversation,
  getConversation,
  listConversations,
  getMessages,
  addMessage,
  deleteConversation,
  updateConversationTitle,
} from '../db/queries/conversations.js';
import type { AIMessage } from '@vitals/shared';
import { isValidUuid } from '../utils/uuid.js';

const MAX_MESSAGE_LENGTH = 4000;

interface SendMessageBody {
  message: string;
  conversationId?: string;
}

export async function chatRoutes(app: FastifyInstance, opts: { env: EnvConfig }): Promise<void> {
  // POST /api/chat — send a message, get a response
  app.post<{ Body: SendMessageBody }>(
    '/api/chat',
    {
      preHandler: apiKeyMiddleware(opts.env.xApiKey),
      config: { rateLimit: { max: 15, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const provider = createAIProvider(opts.env);
      const { message, conversationId } = request.body;

      if (!message || typeof message !== 'string' || message.trim() === '') {
        return reply.code(400).send({ error: 'message is required' });
      }

      if (message.length > MAX_MESSAGE_LENGTH) {
        return reply
          .code(400)
          .send({ error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` });
      }

      const userId = opts.env.dbDefaultUserId;
      let convId = conversationId;

      if (convId && !isValidUuid(convId)) {
        return reply.code(400).send({ error: 'Invalid conversation ID format' });
      }

      // Create conversation if none provided
      if (!convId) {
        const conv = await createConversation(app.db, userId);
        convId = conv.id;
      } else {
        const existing = await getConversation(app.db, convId, userId);
        if (!existing) {
          return reply.code(404).send({ error: 'Conversation not found' });
        }
      }

      // Load history
      const dbMessages = await getMessages(app.db, convId, userId);
      const history: AIMessage[] = dbMessages
        .filter((m) => m.role !== 'tool')
        .map((m) => ({ role: m.role, content: m.content }));

      // Persist user message
      await addMessage(app.db, {
        conversationId: convId,
        role: 'user',
        content: message,
        toolCalls: null,
        toolName: null,
        toolCallId: null,
        tokensUsed: null,
      });

      // Run agentic chat
      const result = await chat(provider, app.db, userId, message, history);

      // Persist tool call records
      for (const tc of result.toolCalls) {
        await addMessage(app.db, {
          conversationId: convId,
          role: 'tool',
          content: tc.result,
          toolCalls: null,
          toolName: tc.toolName,
          toolCallId: null,
          tokensUsed: null,
        });
      }

      // Persist assistant response
      await addMessage(app.db, {
        conversationId: convId,
        role: 'assistant',
        content: result.response,
        toolCalls: result.toolCalls.map((tc) => ({ id: '', name: tc.toolName, input: tc.input })),
        toolName: null,
        toolCallId: null,
        tokensUsed: result.tokensUsed,
      });

      // Auto-title conversation from first message
      const conv = await getConversation(app.db, convId, userId);
      if (conv && !conv.title) {
        const title = message.slice(0, 60) + (message.length > 60 ? '…' : '');
        await updateConversationTitle(app.db, convId, title, userId);
      }

      return reply.send({
        conversationId: convId,
        response: result.response,
        toolCalls: result.toolCalls,
      });
    },
  );

  // GET /api/chat/conversations — list all conversations
  app.get(
    '/api/chat/conversations',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (_request, reply) => {
      const conversations = await listConversations(app.db, opts.env.dbDefaultUserId);
      return reply.send({ conversations });
    },
  );

  // GET /api/chat/conversations/:id — get conversation with messages
  app.get<{ Params: { id: string } }>(
    '/api/chat/conversations/:id',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (request, reply) => {
      const { id } = request.params;
      if (!isValidUuid(id)) {
        return reply.code(400).send({ error: 'Invalid conversation ID format' });
      }
      const userId = opts.env.dbDefaultUserId;
      const conversation = await getConversation(app.db, id, userId);
      if (!conversation) {
        return reply.code(404).send({ error: 'Conversation not found' });
      }
      const messages = await getMessages(app.db, id, userId);
      return reply.send({ conversation, messages });
    },
  );

  // DELETE /api/chat/conversations/:id
  app.delete<{ Params: { id: string } }>(
    '/api/chat/conversations/:id',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (request, reply) => {
      const { id } = request.params;
      if (!isValidUuid(id)) {
        return reply.code(400).send({ error: 'Invalid conversation ID format' });
      }
      const userId = opts.env.dbDefaultUserId;
      const existing = await getConversation(app.db, id, userId);
      if (!existing) {
        return reply.code(404).send({ error: 'Conversation not found' });
      }
      await deleteConversation(app.db, id, userId);
      return reply.code(204).send();
    },
  );
}
