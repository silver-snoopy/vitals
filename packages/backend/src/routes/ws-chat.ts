import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import { createAIProvider } from '../services/ai/ai-service.js';
import { chatStream } from '../services/ai/conversation-service.js';
import {
  createConversation,
  getConversation,
  getMessages,
  addMessage,
  updateConversationTitle,
} from '../db/queries/conversations.js';
import type { AIMessage } from '@vitals/shared';
import type { ToolCallRecord } from '../services/ai/tools/tool-executor.js';

const DEFAULT_USER_ID = 'default';

interface WsChatMessage {
  message: string;
  conversationId?: string;
}

export async function wsChatRoutes(
  app: FastifyInstance,
  opts: { env: EnvConfig },
): Promise<void> {
  app.get<{ Querystring: { token?: string } }>(
    '/ws/chat',
    { websocket: true },
    async (socket, request) => {
      // Auth — same pattern as ws-reports
      if (opts.env.xApiKey) {
        const token = (request.query as { token?: string }).token;
        if (!token || token !== opts.env.xApiKey) {
          socket.send(JSON.stringify({ type: 'error', error: 'Unauthorized' }));
          socket.close(1008, 'Unauthorized');
          return;
        }
      }

      socket.on('message', async (rawData: Buffer) => {
        const provider = createAIProvider(opts.env);
        let payload: WsChatMessage;

        try {
          payload = JSON.parse(rawData.toString()) as WsChatMessage;
        } catch {
          socket.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
          return;
        }

        const { message, conversationId } = payload;

        if (!message || typeof message !== 'string' || message.trim() === '') {
          socket.send(JSON.stringify({ type: 'error', error: 'message is required' }));
          return;
        }

        let convId = conversationId;

        if (!convId) {
          const conv = await createConversation(app.db, DEFAULT_USER_ID);
          convId = conv.id;
          socket.send(JSON.stringify({ type: 'conversation_id', conversationId: convId }));
        } else {
          const existing = await getConversation(app.db, convId);
          if (!existing) {
            socket.send(JSON.stringify({ type: 'error', error: 'Conversation not found' }));
            return;
          }
        }

        // Load history
        const dbMessages = await getMessages(app.db, convId);
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

        const toolCallRecords: ToolCallRecord[] = [];
        let fullResponse = '';

        try {
          for await (const chunk of chatStream(
            provider,
            app.db,
            DEFAULT_USER_ID,
            message,
            history,
            (record) => {
              toolCallRecords.push(record);
              if (socket.readyState === socket.OPEN) {
                socket.send(JSON.stringify({ type: 'tool_call', ...record }));
              }
            },
          )) {
            if (socket.readyState !== socket.OPEN) break;

            if (chunk.type === 'text' && chunk.text) {
              fullResponse += chunk.text;
              socket.send(JSON.stringify({ type: 'text', text: chunk.text }));
            } else if (chunk.type === 'done') {
              socket.send(JSON.stringify({ type: 'done' }));
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify({ type: 'error', error: message }));
          }
          return;
        }

        // Persist assistant response
        await addMessage(app.db, {
          conversationId: convId,
          role: 'assistant',
          content: fullResponse,
          toolCalls: toolCallRecords.map((tc) => ({ id: '', name: tc.toolName, input: tc.input })),
          toolName: null,
          toolCallId: null,
          tokensUsed: null,
        });

        // Auto-title from first message
        const conv = await getConversation(app.db, convId);
        if (conv && !conv.title) {
          const title = message.slice(0, 60) + (message.length > 60 ? '…' : '');
          await updateConversationTitle(app.db, convId, title);
        }
      });
    },
  );
}
