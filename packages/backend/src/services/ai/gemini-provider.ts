import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider, AIMessage, AICompletionResult, AIProviderConfig } from '@vitals/shared';

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

  async complete(
    messages: AIMessage[],
    config?: Partial<AIProviderConfig>,
  ): Promise<AICompletionResult> {
    const model = config?.model || this.model;
    const maxOutputTokens = config?.maxTokens ?? this.maxTokens;

    // Gemini takes system instruction in model config, not in messages array
    const systemMessage = messages.find((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    if (chatMessages.length === 0) {
      throw new Error('At least one user message is required.');
    }

    const generativeModel = this.client.getGenerativeModel({
      model,
      systemInstruction: systemMessage?.content,
      generationConfig: { maxOutputTokens },
    });

    // Gemini uses 'user'/'model' roles (not 'assistant')
    const result = await generativeModel.generateContent({
      contents: chatMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    });

    const content = result.response.text();
    const usage = result.response.usageMetadata;

    return {
      content,
      model, // Gemini SDK does not return model name in the response; use local value
      usage: {
        promptTokens: usage?.promptTokenCount ?? 0,
        completionTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
      },
    };
  }
}
