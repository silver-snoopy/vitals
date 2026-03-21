import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../store/useChatStore';
import { MessageBubble, StreamingBubble } from './MessageBubble';

interface Props {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
}

export function MessageList({ messages, streamingText, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <p className="text-lg font-medium">Ask about your health data</p>
        <div className="space-y-1 text-sm">
          <p>&quot;What was my average protein intake last week?&quot;</p>
          <p>&quot;How has my squat progressed this month?&quot;</p>
          <p>&quot;Show me my weight trend for March.&quot;</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isStreaming && <StreamingBubble text={streamingText} />}
      <div ref={bottomRef} />
    </div>
  );
}
