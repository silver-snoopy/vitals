import type { ActionItem } from '@vitals/shared';
import { Badge } from '@/components/ui/badge';

const priorityVariant: Record<ActionItem['priority'], 'destructive' | 'secondary' | 'outline'> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

export function ActionItemList({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <Badge
            variant={priorityVariant[item.priority]}
            className="mt-0.5 shrink-0 capitalize text-xs"
          >
            {item.priority}
          </Badge>
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
