import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  AIMessage,
  AICompletionResult,
  AIProviderConfig,
  AITool,
  AIToolCompletionResult,
  AIStreamChunk,
} from '@vitals/shared';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_MAX_TOKENS = 8192;

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(config: AIProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model || DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  name(): string {
    return 'claude';
  }

  private buildAnthropicMessages(
    messages: AIMessage[],
  ): Anthropic.MessageParam[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: m.toolCallId ?? '',
                content: m.content,
              },
            ],
          };
        }
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        };
      });
  }

  async complete(
    messages: AIMessage[],
    config?: Partial<AIProviderConfig>,
  ): Promise<AICompletionResult> {
    const model = config?.model || this.model;
    const maxTokens = config?.maxTokens ?? this.maxTokens;

    const systemMessage = messages.find((m) => m.role === 'system');

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemMessage?.content,
      messages: this.buildAnthropicMessages(messages),
    });

    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('');

    return {
      content,
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async completeWithTools(
    messages: AIMessage[],
    tools: AITool[],
    config?: Partial<AIProviderConfig>,
  ): Promise<AIToolCompletionResult> {
    const model = config?.model || this.model;
    const maxTokens = config?.maxTokens ?? this.maxTokens;

    const systemMessage = messages.find((m) => m.role === 'system');

    const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
    }));

    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemMessage?.content,
      messages: this.buildAnthropicMessages(messages),
      tools: anthropicTools,
    });

    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('');

    const toolCalls = response.content
      .filter((block) => block.type === 'tool_use')
      .map((block) => {
        const tb = block as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
        return { id: tb.id, name: tb.name, input: tb.input };
      });

    return {
      content,
      model: response.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      toolCalls,
      stopReason: response.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn',
    };
  }

  async *stream(
    messages: AIMessage[],
    tools?: AITool[],
    config?: Partial<AIProviderConfig>,
  ): AsyncIterable<AIStreamChunk> {
    const model = config?.model || this.model;
    const maxTokens = config?.maxTokens ?? this.maxTokens;

    const systemMessage = messages.find((m) => m.role === 'system');

    const anthropicTools: Anthropic.Tool[] | undefined = tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
    }));

    const stream = this.client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemMessage?.content,
      messages: this.buildAnthropicMessages(messages),
      ...(anthropicTools ? { tools: anthropicTools } : {}),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text', text: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          yield {
            type: 'tool_call_delta',
            toolCall: { input: event.delta.partial_json as unknown as Record<string, unknown> },
          };
        }
      } else if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          yield {
            type: 'tool_call_start',
            toolCall: { id: event.content_block.id, name: event.content_block.name, input: {} },
          };
        }
      } else if (event.type === 'message_stop') {
        yield { type: 'done' };
      }
    }
  }
}
