import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import type { AIProvider, AIMessage, AIStreamChunk } from '@vitals/shared';
import { HEALTH_TOOLS } from './tools/health-tools.js';
import { executeTool, type ToolCallRecord } from './tools/tool-executor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const chatPersona = readFileSync(resolve(__dirname, 'prompts/chat-persona.md'), 'utf-8');

const MAX_ITERATIONS = 10;

export interface ChatResult {
  response: string;
  toolCalls: ToolCallRecord[];
  tokensUsed: number;
}

function buildSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0];
  return `${chatPersona}\n\nToday's date: ${today}`;
}

export async function chat(
  provider: AIProvider,
  db: pg.Pool,
  userId: string,
  userMessage: string,
  history: AIMessage[],
): Promise<ChatResult> {
  const systemMessage: AIMessage = { role: 'system', content: buildSystemPrompt() };
  const messages: AIMessage[] = [
    systemMessage,
    ...history,
    { role: 'user', content: userMessage },
  ];

  const allToolCalls: ToolCallRecord[] = [];
  let totalTokens = 0;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const result = await provider.completeWithTools(messages, HEALTH_TOOLS);
    totalTokens += result.usage.totalTokens;

    if (result.stopReason === 'end_turn' || result.toolCalls.length === 0) {
      return {
        response: result.content,
        toolCalls: allToolCalls,
        tokensUsed: totalTokens,
      };
    }

    // Append assistant message with tool call info
    messages.push({
      role: 'assistant',
      content: result.content || '',
    });

    // Execute each tool call and append results
    for (const toolCall of result.toolCalls) {
      const toolResult = await executeTool(toolCall.name, toolCall.input, db, userId);

      allToolCalls.push({
        toolName: toolCall.name,
        input: toolCall.input,
        result: toolResult,
      });

      messages.push({
        role: 'tool',
        content: toolResult,
        toolCallId: toolCall.id,
        toolName: toolCall.name,
      });
    }
  }

  // Max iterations reached — return whatever we have
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  return {
    response:
      lastAssistantMsg?.content ||
      'I reached the maximum number of tool calls while trying to answer your question. Please try a more specific question.',
    toolCalls: allToolCalls,
    tokensUsed: totalTokens,
  };
}

export async function* chatStream(
  provider: AIProvider,
  db: pg.Pool,
  userId: string,
  userMessage: string,
  history: AIMessage[],
  onToolCall?: (record: ToolCallRecord) => void,
): AsyncIterable<AIStreamChunk> {
  const systemMessage: AIMessage = { role: 'system', content: buildSystemPrompt() };
  const messages: AIMessage[] = [
    systemMessage,
    ...history,
    { role: 'user', content: userMessage },
  ];

  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Collect streaming chunks — we need to detect tool calls before yielding
    const chunks: AIStreamChunk[] = [];
    for await (const chunk of provider.stream(messages, HEALTH_TOOLS)) {
      chunks.push(chunk);
    }

    // Check if any tool calls were made
    const toolCallChunks = chunks.filter((c) => c.type === 'tool_call_start');

    if (toolCallChunks.length === 0) {
      // No tool calls — stream text chunks to caller
      for (const chunk of chunks) {
        yield chunk;
      }
      return;
    }

    // Tool calls present — execute them, then continue loop
    // Yield tool_call_start chunks so the UI can show transparency badges
    for (const chunk of chunks.filter((c) => c.type === 'tool_call_start')) {
      yield chunk;
    }

    const assistantText = chunks
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');

    messages.push({ role: 'assistant', content: assistantText });

    for (const chunk of toolCallChunks) {
      if (!chunk.toolCall?.name || !chunk.toolCall?.id) continue;

      const toolResult = await executeTool(
        chunk.toolCall.name,
        (chunk.toolCall.input as Record<string, unknown>) ?? {},
        db,
        userId,
      );

      const record: ToolCallRecord = {
        toolName: chunk.toolCall.name,
        input: (chunk.toolCall.input as Record<string, unknown>) ?? {},
        result: toolResult,
      };

      onToolCall?.(record);

      messages.push({
        role: 'tool',
        content: toolResult,
        toolCallId: chunk.toolCall.id,
        toolName: chunk.toolCall.name,
      });
    }
  }

  yield {
    type: 'text',
    text: 'I reached the maximum number of tool calls. Please try a more specific question.',
  };
  yield { type: 'done' };
}
