import { create } from 'zustand';
import type { ToolCallRecord } from '../api/hooks/useChat';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: ToolCallRecord[];
  createdAt: string;
}

interface ChatState {
  activeConversationId: string | null;
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  appendUserMessage: (content: string) => void;
  startStreaming: () => void;
  appendStreamChunk: (text: string) => void;
  appendToolCall: (tc: ToolCallRecord) => void;
  finalizeStreaming: (errorText?: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  messages: [],
  streamingText: '',
  isStreaming: false,

  setActiveConversation: (id) => set({ activeConversationId: id, messages: [], streamingText: '' }),

  setMessages: (messages) => set({ messages }),

  appendUserMessage: (content) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content,
          toolCalls: [],
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  startStreaming: () => set({ isStreaming: true, streamingText: '' }),

  appendStreamChunk: (text) =>
    set((s) => ({ streamingText: s.streamingText + text })),

  appendToolCall: (tc) =>
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        // Attach to the in-progress assistant message
        messages[messages.length - 1] = {
          ...last,
          toolCalls: [...last.toolCalls, tc],
        };
        return { messages };
      }
      // No assistant message yet (first tool call in a new turn) — create a placeholder
      return {
        messages: [
          ...messages,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant' as const,
            content: '',
            toolCalls: [tc],
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }),

  finalizeStreaming: (errorText?: string) =>
    set((s) => {
      const contentToAdd = errorText ?? s.streamingText;
      return {
        isStreaming: false,
        streamingText: '',
        messages: contentToAdd
          ? [
              ...s.messages,
              {
                id: `assistant-${Date.now()}`,
                role: 'assistant' as const,
                content: errorText ? `⚠️ ${errorText}` : s.streamingText,
                toolCalls: [],
                createdAt: new Date().toISOString(),
              },
            ]
          : s.messages,
      };
    }),

  reset: () =>
    set({ activeConversationId: null, messages: [], streamingText: '', isStreaming: false }),
}));
