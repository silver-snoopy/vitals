import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWidgetOrderStore, WIDGET_LABELS } from '@/store/useWidgetOrderStore';

export function WidgetOrderSettings() {
  const order = useWidgetOrderStore((s) => s.order);
  const moveUp = useWidgetOrderStore((s) => s.moveUp);
  const moveDown = useWidgetOrderStore((s) => s.moveDown);
  const reset = useWidgetOrderStore((s) => s.reset);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Widget Order</span>
        <Button variant="ghost" size="xs" className="gap-1" onClick={reset}>
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      </div>
      <ul className="space-y-1">
        {order.map((id, idx) => (
          <li
            key={id}
            className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1"
          >
            <span className="text-sm">{WIDGET_LABELS[id] ?? id}</span>
            <div className="flex gap-0.5">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => moveUp(id)}
                disabled={idx === 0}
                aria-label={`Move ${WIDGET_LABELS[id]} up`}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => moveDown(id)}
                disabled={idx === order.length - 1}
                aria-label={`Move ${WIDGET_LABELS[id]} down`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
