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
  const messages: AIMessage[] = [systemMessage, ...history, { role: 'user', content: userMessage }];

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

interface AssembledToolCall {
  id: string;
  name: string;
  inputFromStart: Record<string, unknown>; // Gemini: full input in tool_call_start
  inputJson: string; // Claude: accumulated JSON fragments from tool_call_delta
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
  const messages: AIMessage[] = [systemMessage, ...history, { role: 'user', content: userMessage }];

  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const textChunks: AIStreamChunk[] = [];
    const toolCallMap = new Map<string, AssembledToolCall>();
    let activeToolCallId: string | null = null;

    // Collect all chunks, accumulating tool_call_delta fragments per tool call ID
    for await (const chunk of provider.stream(messages, HEALTH_TOOLS)) {
      if (chunk.type === 'text') {
        textChunks.push(chunk);
      } else if (chunk.type === 'tool_call_start' && chunk.toolCall?.id && chunk.toolCall?.name) {
        activeToolCallId = chunk.toolCall.id;
        toolCallMap.set(activeToolCallId, {
          id: chunk.toolCall.id,
          name: chunk.toolCall.name,
          inputFromStart: chunk.toolCall.input ?? {},
          inputJson: '',
        });
      } else if (chunk.type === 'tool_call_delta' && activeToolCallId) {
        // Accumulate partial JSON string fragments
        const partialJson =
          typeof chunk.toolCall?.input === 'string'
            ? chunk.toolCall.input
            : ((chunk.toolCall?.input as unknown as string) ?? '');
        const entry = toolCallMap.get(activeToolCallId);
        if (entry) entry.inputJson += partialJson;
      }
      // 'done' chunk: handled by loop exit
    }

    const assembledToolCalls = Array.from(toolCallMap.values());

    if (assembledToolCalls.length === 0) {
      // No tool calls — stream text chunks to caller
      for (const chunk of textChunks) {
        yield chunk;
      }
      yield { type: 'done' };
      return;
    }

    // Yield tool_call_start badges so the UI can show transparency indicators
    for (const tc of assembledToolCalls) {
      yield { type: 'tool_call_start', toolCall: { id: tc.id, name: tc.name, input: {} } };
    }

    // Resolve all tool inputs before pushing the assistant message so we can
    // include tool_use blocks (required by Claude's API before tool_result blocks)
    const resolvedToolCalls = assembledToolCalls.map((tc) => {
      let input: Record<string, unknown> = tc.inputFromStart;
      if (tc.inputJson) {
        try {
          input = JSON.parse(tc.inputJson) as Record<string, unknown>;
        } catch {
          console.error(
            `[chatStream] Failed to parse tool input JSON for ${tc.name}:`,
            tc.inputJson,
          );
        }
      }
      return { ...tc, resolvedInput: input };
    });

    const assistantText = textChunks.map((c) => c.text ?? '').join('');
    messages.push({
      role: 'assistant',
      content: assistantText,
      toolUses: resolvedToolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        input: tc.resolvedInput,
      })),
    });

    // Execute each tool and push results
    for (const tc of resolvedToolCalls) {
      const toolResult = await executeTool(tc.name, tc.resolvedInput, db, userId);

      const record: ToolCallRecord = {
        toolName: tc.name,
        input: tc.resolvedInput,
        result: toolResult,
      };
      onToolCall?.(record);

      messages.push({
        role: 'tool',
        content: toolResult,
        toolCallId: tc.id,
        toolName: tc.name,
      });
    }
  }

  yield {
    type: 'text',
    text: 'I reached the maximum number of tool calls. Please try a more specific question.',
  };
  yield { type: 'done' };
}
