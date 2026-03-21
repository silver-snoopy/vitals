import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { RefreshCw, Loader2, ChevronRight } from 'lucide-react';
import type { WeeklyReport, ActionItem, ReportSections, ScorecardEntry } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLatestReport } from '@/api/hooks/useReports';
import { useReportGenerationStore } from '@/store/useReportGenerationStore';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { GenerateReportDialog } from '@/components/reports/GenerateReportDialog';
import { cn } from '@/lib/utils';
import { priorityColor, priorityVariant, scoreColor } from '@/components/reports/report-utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CollapsibleSectionProps {
  title: string;
  content: string;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, content, defaultOpen = false }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!content) return null;

  return (
    <div className="border-t border-border">
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="prose prose-sm dark:prose-invert max-w-none px-4 pb-3 leading-relaxed">
          <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        </div>
      )}
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
      <div className="flex-1 space-y-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {item.category}
        </span>
        <p className="text-sm leading-relaxed">{item.text}</p>
      </div>
      <Badge variant={priorityVariant[item.priority]} className="mt-0.5 shrink-0 text-[10px]">
        {item.priority}
      </Badge>
    </div>
  );
}

function Scorecard({ scorecard }: { scorecard: Record<string, ScorecardEntry> }) {
  const entries = Object.entries(scorecard);
  if (entries.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 px-4 pb-3">
      {entries.map(([label, entry]) => (
        <div key={label} className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold',
              scoreColor(entry.score),
            )}
          >
            {entry.score}
          </div>
          <span className="text-xs capitalize text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

const sectionConfig: { key: keyof ReportSections; title: string }[] = [
  { key: 'whatsWorking', title: "What's Working" },
  { key: 'hazards', title: 'Hazards' },
  { key: 'recommendations', title: 'Recommendations' },
  { key: 'nutritionAnalysis', title: 'Nutrition Analysis' },
  { key: 'trainingLoad', title: 'Training Load' },
  { key: 'biometricsOverview', title: 'Biometrics Overview' },
  { key: 'crossDomainCorrelation', title: 'Cross-Domain Correlation' },
];

function ReportSectionsPanel({ sections }: { sections: ReportSections }) {
  return (
    <>
      {sections.scorecard && <Scorecard scorecard={sections.scorecard} />}
      {sectionConfig.map(({ key, title }) => {
        const value = sections[key];
        if (typeof value !== 'string' || !value) return null;
        return <CollapsibleSection key={key} title={title} content={value} />;
      })}
    </>
  );
}

export function ReportPanel() {
  const { data, isLoading } = useLatestReport();
  const report: WeeklyReport | null | undefined = data;
  const hasReport = !!report;

  const { pendingReportId, status } = useReportGenerationStore();
  const isGenerating = pendingReportId !== null && status !== 'completed' && status !== 'failed';

  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) return <CardSkeleton />;

  return (
    <>
      <Card>
        {!report ? (
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
            <p>No reports yet. Generate your first weekly insights.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating&hellip;
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generate Latest Insights
                </>
              )}
            </Button>
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">AI Weekly Report</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(report.periodStart), 'MMM d')} –{' '}
                    {format(parseISO(report.periodEnd), 'MMM d, yyyy')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={isGenerating}
                  title="Re-Generate Latest Insights"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>

            {/* Summary */}
            <div className="border-t border-border px-4 py-3">
              <p className="text-sm leading-relaxed text-muted-foreground">{report.summary}</p>
            </div>

            {/* Action items */}
            {report.actionItems.length > 0 && (
              <div className="border-t border-border px-4 py-3">
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Action Items
                </h3>
                <div className="space-y-2">
                  {report.actionItems.map((item, i) => (
                    <ActionItemCard key={`${item.category}-${item.priority}-${i}`} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Sections (scorecard + expandable) */}
            {report.sections && <ReportSectionsPanel sections={report.sections} />}
          </>
        )}
      </Card>

      <GenerateReportDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        hasExistingReport={hasReport}
      />
    </>
  );
}
