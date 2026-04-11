import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { PlanVersion } from '@vitals/shared';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PlanVersionHistoryProps {
  versions: PlanVersion[];
  activeVersionId: string | null;
}

const SOURCE_LABELS: Record<PlanVersion['source'], string> = {
  user: 'Manual edit',
  tuner: 'AI tuned',
  imported: 'Imported',
};

const SOURCE_VARIANTS: Record<
  PlanVersion['source'],
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  user: 'secondary',
  tuner: 'default',
  imported: 'outline',
};

/**
 * Collapsible list of plan versions with source badge and date.
 */
export function PlanVersionHistory({ versions, activeVersionId }: PlanVersionHistoryProps) {
  const [open, setOpen] = useState(false);

  if (versions.length === 0) return null;

  return (
    <div className="mt-4">
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-1 text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        Version history ({versions.length})
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {open && (
        <div className="mt-2 space-y-1 rounded-md border p-3">
          {versions.map((version) => {
            const isActive = version.id === activeVersionId;
            return (
              <div
                key={version.id}
                className={`flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-sm ${
                  isActive ? 'bg-accent' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">v{version.versionNumber}</span>
                  {isActive && (
                    <Badge variant="secondary" className="text-xs">
                      current
                    </Badge>
                  )}
                  <Badge variant={SOURCE_VARIANTS[version.source]} className="text-xs">
                    {SOURCE_LABELS[version.source]}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  {version.notes && <span className="hidden sm:inline">{version.notes}</span>}
                  <span className="text-xs">
                    {format(parseISO(version.createdAt), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
