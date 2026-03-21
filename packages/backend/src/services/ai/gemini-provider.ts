import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Content, FunctionDeclaration, Part } from '@google/generative-ai';
import type {
  AIProvider,
  AIMessage,
  AICompletionResult,
  AIProviderConfig,
  AITool,
  AIToolCompletionResult,
  AIStreamChunk,
} from '@vitals/shared';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_MAX_TOKENS = 8192;

export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private model: string;
  private maxTokens: number;

  constructor(config: AIProviderConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model || DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  name(): string {
    return 'gemini';
  }

  private buildGeminiContents(messages: AIMessage[]): Content[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            parts: [
              {
                functionResponse: {
                  name: m.toolName ?? '',
                  response: { result: m.content },
                },
              },
            ],
          };
        }
        return {
          role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
          parts: [{ text: m.content }] as Part[],
        };
      });
  }

  async complete(
    messages: AIMessage[],
    config?: Partial<AIProviderConfig>,
  ): Promise<AICompletionResult> {
    const model = config?.model || this.model;
    const maxOutputTokens = config?.maxTokens ?? this.maxTokens;

    const systemMessage = messages.find((m) => m.role === 'system');
    const contents = this.buildGeminiContents(messages);

    if (contents.length === 0) {
      throw new Error('At least one user message is required.');
    }

    const generativeModel = this.client.getGenerativeModel({
      model,
      systemInstruction: systemMessage?.content,
      generationConfig: { maxOutputTokens },
    });

    const result = await generativeModel.generateContent({ contents });
    const content = result.response.text();
    const usage = result.response.usageMetadata;

    return {
      content,
      model,
      usage: {
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
      },
    };
  }

  async completeWithTools(
    messages: AIMessage[],
    tools: AITool[],
    config?: Partial<AIProviderConfig>,
  ): Promise<AIToolCompletionResult> {
    const model = config?.model || this.model;
    const maxOutputTokens = config?.maxTokens ?? this.maxTokens;

    const systemMessage = messages.find((m) => m.role === 'system');
    const contents = this.buildGeminiContents(messages);

    if (contents.length === 0) {
      throw new Error('At least one user message is required.');
    }

    const functionDeclarations: FunctionDeclaration[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema as unknown as FunctionDeclaration['parameters'],
    }));

    const generativeModel = this.client.getGenerativeModel({
      model,
      systemInstruction: systemMessage?.content,
      generationConfig: { maxOutputTokens },
      tools: [{ functionDeclarations }],
    });

    const result = await generativeModel.generateContent({ contents });
    const response = result.response;
    const usage = response.usageMetadata;

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    const textParts = parts.filter((p) => p.text).map((p) => p.text ?? '');
    const content = textParts.join('');

    const toolCalls = parts
      .filter((p) => p.functionCall)
      .map((p) => ({
        id: `gemini-${p.functionCall!.name}-${Date.now()}`,
        name: p.functionCall!.name,
        input: (p.functionCall!.args ?? {}) as Record<string, unknown>,
      }));

    const finishReason = candidate?.finishReason;
    const stopReason: 'tool_use' | 'end_turn' =
      finishReason === 'STOP' && toolCalls.length > 0 ? 'tool_use' : 'end_turn';

    return {
      content,
      model,
      usage: {
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
      },
      toolCalls,
      stopReason,
    };
  }

  async *stream(
    messages: AIMessage[],
    tools?: AITool[],
    config?: Partial<AIProviderConfig>,
  ): AsyncIterable<AIStreamChunk> {
    const model = config?.model || this.model;
    const maxOutputTokens = config?.maxTokens ?? this.maxTokens;

    const systemMessage = messages.find((m) => m.role === 'system');
    const contents = this.buildGeminiContents(messages);

    if (contents.length === 0) {
      throw new Error('At least one user message is required.');
    }

    const functionDeclarations: FunctionDeclaration[] | undefined = tools?.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema as unknown as FunctionDeclaration['parameters'],
    }));

    const generativeModel = this.client.getGenerativeModel({
      model,
      systemInstruction: systemMessage?.content,
      generationConfig: { maxOutputTokens },
      ...(functionDeclarations ? { tools: [{ functionDeclarations }] } : {}),
    });

    const result = await generativeModel.generateContentStream({ contents });

    for await (const chunk of result.stream) {
      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.text) {
          yield { type: 'text', text: part.text };
        } else if (part.functionCall) {
          yield {
            type: 'tool_call_start',
            toolCall: {
              id: `gemini-${part.functionCall.name}-${Date.now()}`,
              name: part.functionCall.name,
              input: (part.functionCall.args ?? {}) as Record<string, unknown>,
            },
          };
        }
      }
    }

    yield { type: 'done' };
  }
}
