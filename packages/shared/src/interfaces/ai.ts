export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolUses?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
}

export interface AICompletionResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AITool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AIToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AIToolCompletionResult extends AICompletionResult {
  toolCalls: AIToolCall[];
  stopReason: 'end_turn' | 'tool_use';
}

export interface AIStreamChunk {
  type: 'text' | 'tool_call_start' | 'tool_call_delta' | 'done';
  text?: string;
  toolCall?: Partial<AIToolCall>;
}

export interface StructuredOutputConfig {
  /** Tool name used internally for the schema constraint */
  name: string;
  /** Human-readable description of what the output represents */
  description: string;
  /** JSON Schema for the expected output */
  schema: Record<string, unknown>;
}

export interface AIProvider {
  complete(messages: AIMessage[], config?: Partial<AIProviderConfig>): Promise<AICompletionResult>;
  completeWithTools(
    messages: AIMessage[],
    tools: AITool[],
    config?: Partial<AIProviderConfig>,
  ): Promise<AIToolCompletionResult>;
  stream(
    messages: AIMessage[],
    tools?: AITool[],
    config?: Partial<AIProviderConfig>,
  ): AsyncIterable<AIStreamChunk>;
  completeStructured?<T>(
    messages: AIMessage[],
    output: StructuredOutputConfig,
    config?: Partial<AIProviderConfig>,
  ): Promise<{ data: T } & AICompletionResult>;
  name(): string;
}
