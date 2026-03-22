import type { TrackedActionItem } from '@vitals/shared';
import { InteractiveActionItemCard } from './InteractiveActionItemCard';

interface Props {
  items: TrackedActionItem[];
  emptyMessage?: string;
}

export function ActionItemsList({ items, emptyMessage = 'No items' }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {items.map((item) => (
        <InteractiveActionItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
