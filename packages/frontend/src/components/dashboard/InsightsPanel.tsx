import { format, parseISO } from 'date-fns';
import { BarChart3, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ActionItem } from '@vitals/shared';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLatestReport } from '@/api/hooks/useReports';
import { useReportGenerationStore } from '@/store/useReportGenerationStore';
import { cn } from '@/lib/utils';
import {
  priorityColor,
  priorityVariant,
  scoreRingColor,
  extractBullets,
} from '@/components/reports/report-utils';

function ScoreRing({ score }: { score: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;

  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted/30"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
          className={scoreRingColor(score)}
        />
      </svg>
      <span className="absolute text-sm font-bold">{score}</span>
    </div>
  );
}

function ActionItemCard({ item }: { item: ActionItem }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 border-l-[3px] rounded-r-md bg-muted/30 px-3 py-2.5',
        priorityColor[item.priority],
      )}
    >
      <div className="flex-1 space-y-0.5 min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {item.category}
        </span>
        <p className="text-sm leading-relaxed line-clamp-2">{item.text}</p>
      </div>
      <Badge variant={priorityVariant[item.priority]} className="mt-0.5 shrink-0 text-[10px]">
        {item.priority}
      </Badge>
    </div>
  );
}

function FocusAreaCard({
  title,
  icon: Icon,
  bullets,
  colorClasses,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  bullets: string[];
  colorClasses: string;
}) {
  if (bullets.length === 0) return null;

  return (
    <div className={cn('rounded-lg border px-4 py-3', colorClasses)}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <ul className="space-y-1">
        {bullets.map((bullet, i) => (
          <li key={i} className="text-sm leading-relaxed text-muted-foreground line-clamp-1">
            <span className="mr-1.5 text-muted-foreground/50">&bull;</span>
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InsightsPanel() {
  const { data: report, isLoading } = useLatestReport();
  const status = useReportGenerationStore((s) => s.status);

  if (isLoading) return null;

  const isGenerating =
    status === 'pending' || status === 'collecting_data' || status === 'generating';

  if (isGenerating) {
    return (
      <Card className="px-4 py-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Generating report&hellip;</span>
        </div>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">No report yet</span>
          </div>
          <Link to="/reports" className="text-sm font-medium text-primary hover:underline">
            Generate &rarr;
          </Link>
        </div>
      </Card>
    );
  }

  const score = report.sections?.scorecard?.overall?.score;
  const actions = report.actionItems ?? [];
  const topActions = actions.slice(0, 3);
  const remainingCount = Math.max(0, actions.length - 3);

  const workingBullets = report.sections?.whatsWorking
    ? extractBullets(report.sections.whatsWorking, 3)
    : [];
  const hazardBullets = report.sections?.hazards ? extractBullets(report.sections.hazards, 3) : [];

  const hasFocusAreas = workingBullets.length > 0 || hazardBullets.length > 0;

  return (
    <Card className="overflow-hidden">
      {/* Section 1: Score + Summary */}
      <div className="flex flex-col items-center gap-4 px-4 py-4 md:flex-row md:items-start">
        {score != null && <ScoreRing score={score} />}
        <div className="flex-1 min-w-0 text-center md:text-left">
          <p className="text-sm leading-relaxed">{report.summary}</p>
          <div className="mt-1.5 flex items-center justify-center gap-3 md:justify-start">
            <span className="text-xs text-muted-foreground">
              {format(parseISO(report.periodStart), 'MMM d')} &ndash;{' '}
              {format(parseISO(report.periodEnd), 'MMM d, yyyy')}
            </span>
            <Link to="/reports" className="text-xs font-medium text-primary hover:underline">
              View Report &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Section 2: Top 3 Action Items */}
      {topActions.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            This Week&rsquo;s Focus
          </h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {topActions.map((item, i) => (
              <ActionItemCard key={`${item.category}-${item.priority}-${i}`} item={item} />
            ))}
          </div>
          {remainingCount > 0 && (
            <Link
              to="/reports"
              className="mt-2 inline-block text-xs text-muted-foreground hover:text-primary"
            >
              +{remainingCount} more in full report
            </Link>
          )}
        </div>
      )}

      {/* Section 3: Focus Areas */}
      {hasFocusAreas && (
        <div className="border-t border-border px-4 py-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FocusAreaCard
              title="What's Working"
              icon={CheckCircle2}
              bullets={workingBullets}
              colorClasses="bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
            />
            <FocusAreaCard
              title="Watch Out"
              icon={AlertTriangle}
              bullets={hazardBullets}
              colorClasses="bg-amber-500/10 border-amber-500/20 text-amber-500"
            />
          </div>
        </div>
      )}
    </Card>
  );
}
