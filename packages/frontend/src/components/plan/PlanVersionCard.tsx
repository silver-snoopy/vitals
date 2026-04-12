import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { PlanVersion } from '@vitals/shared';
import { ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlanDayCard } from './PlanDayCard';

interface PlanVersionCardProps {
  version: PlanVersion;
  isActive: boolean;
  defaultExpanded?: boolean;
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

export function PlanVersionCard({
  version,
  isActive,
  defaultExpanded = false,
}: PlanVersionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const days = version.data.days ?? [];

  return (
    <Card
      className={isActive ? 'ring-2 ring-green-500/70' : ''}
      data-testid={`version-card-${version.versionNumber}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              v{version.versionNumber}
              {isActive && (
                <Badge
                  className="bg-green-500/15 text-green-700 dark:text-green-400 text-xs"
                  data-testid="active-indicator"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              )}
              <Badge variant={SOURCE_VARIANTS[version.source]} className="text-xs">
                {SOURCE_LABELS[version.source]}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{format(parseISO(version.createdAt), 'MMM d, yyyy')}</span>
              {version.notes && <span className="hidden sm:inline">— {version.notes}</span>}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {days.map((day, i) => (
            <PlanDayCard key={`${day.name}-${i}`} day={day} dayIndex={i} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
