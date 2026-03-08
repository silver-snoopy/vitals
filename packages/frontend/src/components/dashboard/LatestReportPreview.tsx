import { format, parseISO } from 'date-fns';
import type { WeeklyReport } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLatestReport } from '@/api/hooks/useReports';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';

const priorityVariant: Record<'high' | 'medium' | 'low', 'destructive' | 'secondary' | 'outline'> =
  {
    high: 'destructive',
    medium: 'secondary',
    low: 'outline',
  };

export function LatestReportPreview() {
  const { data, isLoading } = useLatestReport();
  const report: WeeklyReport | null | undefined = data;

  if (isLoading) return <CardSkeleton />;
  if (!report) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No reports yet. Generate one via POST /api/reports/generate.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Latest AI Report — {format(parseISO(report.periodStart), 'MMM d')} to{' '}
          {format(parseISO(report.periodEnd), 'MMM d, yyyy')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{report.summary}</p>
        <div className="space-y-1">
          {report.actionItems.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <Badge variant={priorityVariant[item.priority]} className="mt-0.5 shrink-0 text-xs">
                {item.priority}
              </Badge>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
