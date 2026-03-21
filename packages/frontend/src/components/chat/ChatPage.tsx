import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useChatStore } from '../../store/useChatStore';
import { useConversations, useConversation, useChatWebSocket } from '../../api/hooks/useChat';
import type { WsChatEvent } from '../../api/hooks/useChat';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { ConversationList } from './ConversationList';
import type { ChatMessage } from '../../store/useChatStore';

export function ChatPage() {
  const queryClient = useQueryClient();
  const {
    activeConversationId,
    messages,
    streamingText,
    isStreaming,
    setActiveConversation,
    setMessages,
    appendUserMessage,
    startStreaming,
    appendStreamChunk,
    appendToolCall,
    finalizeStreaming,
  } = useChatStore();

  const { data: conversations = [] } = useConversations();
  const { data: conversationData } = useConversation(activeConversationId);

  // Load messages when switching conversations
  useEffect(() => {
    if (!conversationData) return;
    const loaded: ChatMessage[] = conversationData.messages
      .filter((m) => m.role !== 'tool')
      .map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        toolCalls: m.toolCalls
          ? m.toolCalls.map((tc) => ({ toolName: tc.name, input: tc.input, result: '' }))
          : [],
        createdAt: m.createdAt,
      }));
    setMessages(loaded);
  }, [conversationData, setMessages]);

  function handleWsEvent(event: WsChatEvent) {
    switch (event.type) {
      case 'conversation_id':
        if (event.conversationId) {
          setActiveConversation(event.conversationId);
          void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
        }
        break;
      case 'text':
        appendStreamChunk(event.text ?? '');
        break;
      case 'tool_call':
        appendToolCall({
          toolName: event.toolName ?? '',
          input: event.input ?? {},
          result: event.result ?? '',
        });
        break;
      case 'done':
        finalizeStreaming();
        void queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
        break;
      case 'error':
        finalizeStreaming(event.error);
        break;
    }
  }

  const { send } = useChatWebSocket(true, handleWsEvent);

  function handleSend(message: string) {
    appendUserMessage(message);
    startStreaming();
    send(message, activeConversationId ?? undefined);
  }

  function handleSelectConversation(id: string) {
    setActiveConversation(id);
  }

  function handleNewConversation() {
    setActiveConversation(null);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)]">
      {/* Sidebar — desktop only */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-border md:flex md:flex-col overflow-y-auto">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Conversations</h2>
        </div>
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
        />
      </aside>

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header with new chat button */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2 md:hidden">
          <h1 className="text-sm font-semibold">Chat</h1>
          <button
            onClick={handleNewConversation}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            New
          </button>
        </div>

        <MessageList
          messages={messages}
          streamingText={streamingText}
          isStreaming={isStreaming}
        />

        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </div>
    </div>
  );
}
