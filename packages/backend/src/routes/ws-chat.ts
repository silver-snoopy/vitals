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

const MAX_MESSAGE_LENGTH = 4000;

interface WsChatMessage {
  message: string;
  conversationId?: string;
}

export async function wsChatRoutes(app: FastifyInstance, opts: { env: EnvConfig }): Promise<void> {
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

      let isProcessing = false;

      socket.on('message', async (rawData: Buffer) => {
        // Guard against concurrent messages corrupting conversation state
        if (isProcessing) {
          socket.send(
            JSON.stringify({ type: 'error', error: 'A message is already being processed' }),
          );
          return;
        }
        isProcessing = true;

        try {
          await handleMessage(rawData);
        } finally {
          isProcessing = false;
        }
      });

      async function handleMessage(rawData: Buffer) {
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

        if (message.length > MAX_MESSAGE_LENGTH) {
          socket.send(
            JSON.stringify({
              type: 'error',
              error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
            }),
          );
          return;
        }

        let convId = conversationId;

        // DB setup — errors here must reach the client
        try {
          if (!convId) {
            const conv = await createConversation(app.db, opts.env.dbDefaultUserId);
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

          await streamResponse(provider, opts.env.dbDefaultUserId, convId, message, history);
        } catch (err) {
          const errMessage = err instanceof Error ? err.message : 'Unknown error';
          app.log.error({ err, convId }, 'ws-chat: setup or DB error');
          if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify({ type: 'error', error: errMessage }));
          }
        }
      }

      async function streamResponse(
        provider: ReturnType<typeof createAIProvider>,
        userId: string,
        convId: string,
        message: string,
        history: AIMessage[],
      ) {
        const toolCallRecords: ToolCallRecord[] = [];
        let fullResponse = '';

        try {
          for await (const chunk of chatStream(
            provider,
            app.db,
            userId,
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
          const errMessage = err instanceof Error ? err.message : 'Unknown error';
          app.log.error({ err, convId }, 'ws-chat: stream error');
          if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify({ type: 'error', error: errMessage }));
          }
          return;
        }

        // Persist assistant response — log errors but don't surface to client (response already sent)
        try {
          await addMessage(app.db, {
            conversationId: convId,
            role: 'assistant',
            content: fullResponse,
            toolCalls: toolCallRecords.map((tc) => ({
              id: '',
              name: tc.toolName,
              input: tc.input,
            })),
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
        } catch (err) {
          app.log.error({ err, convId }, 'ws-chat: failed to persist assistant response');
        }
      }
    },
  );
}
