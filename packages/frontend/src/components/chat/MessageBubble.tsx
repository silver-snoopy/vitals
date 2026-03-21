import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../../store/useChatStore';
import { ToolCallPanel } from './ToolCallPanel';

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start" data-testid="assistant-bubble">
      <div className="max-w-[85%] space-y-1">
        <ToolCallPanel toolCalls={message.toolCalls} />
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 leading-relaxed">
          <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
        </div>
      </div>
    </div>
  );
}

interface StreamingBubbleProps {
  text: string;
}

export function StreamingBubble({ text }: StreamingBubbleProps) {
  return (
    <div className="flex justify-start" data-testid="streaming-bubble">
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5">
        <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
          <Markdown remarkPlugins={[remarkGfm]}>{text || '…'}</Markdown>
        </div>
      </div>
    </div>
  );
}
