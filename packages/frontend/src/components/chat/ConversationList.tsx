import type { ConversationSummary } from '../../api/hooks/useChat';
import { useDeleteConversation } from '../../api/hooks/useChat';

interface Props {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ConversationList({ conversations, activeId, onSelect, onNew }: Props) {
  const deleteMutation = useDeleteConversation();

  return (
    <div className="flex flex-col gap-1 p-3">
      <button
        onClick={onNew}
        className="mb-2 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
      >
        + New conversation
      </button>

      {conversations.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-4">No conversations yet</p>
      )}

      {conversations.map((conv) => (
        <div
          key={conv.id}
          data-testid="conversation-item"
          className={`group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer ${
            conv.id === activeId
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-muted text-foreground'
          }`}
          onClick={() => onSelect(conv.id)}
        >
          <span className="flex-1 truncate">{conv.title ?? 'New conversation'}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate(conv.id);
            }}
            className="hidden text-muted-foreground hover:text-destructive group-hover:block text-xs"
            title="Delete"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
