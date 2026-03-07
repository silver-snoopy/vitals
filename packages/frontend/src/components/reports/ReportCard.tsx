import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { WeeklyReport } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AIInsights }     from './AIInsights';
import { ActionItemList } from './ActionItemList';

export function ReportCard({ report }: { report: WeeklyReport }) {
  const [expanded, setExpanded] = useState(false);

  const coverageBadges = [
    { label: `${report.dataCoverage.nutritionDays}d nutrition`,   ok: report.dataCoverage.nutritionDays > 0 },
    { label: `${report.dataCoverage.workoutDays}d workouts`,     ok: report.dataCoverage.workoutDays > 0 },
    { label: `${report.dataCoverage.biometricDays}d biometrics`, ok: report.dataCoverage.biometricDays > 0 },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {format(parseISO(report.periodStart), 'MMM d')} –{' '}
              {format(parseISO(report.periodEnd), 'MMM d, yyyy')}
            </CardTitle>
            <div className="flex flex-wrap gap-1">
              {coverageBadges.map(({ label, ok }) => (
                <Badge key={label} variant={ok ? 'secondary' : 'outline'} className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{report.summary}</p>
        {expanded && (
          <>
            <AIInsights insights={report.insights} />
            <ActionItemList items={report.actionItems} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
