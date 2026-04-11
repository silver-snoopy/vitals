import { useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCurrentPlan } from '@/api/hooks/useWorkoutPlan';
import { PlanEditor } from './PlanEditor';
import { PlanDayCard } from './PlanDayCard';
import { PlanVersionHistory } from './PlanVersionHistory';

/**
 * /plan route — Workout Plan page.
 *
 * Empty state: "Create your plan" card with inline PlanEditor.
 * Populated state: version badge + day cards + version history panel.
 */
export function PlanPage() {
  const { data, isLoading } = useCurrentPlan();
  const [editOpen, setEditOpen] = useState(false);

  const planResponse = data?.data;
  const plan = planResponse?.plan ?? null;
  const latestVersion = planResponse?.latestVersion ?? null;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state
  if (!plan || !latestVersion) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Workout Plan</h1>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Create your plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Paste your workout plan below. The AI will parse it into a structured format.
            </p>
            <PlanEditor />
          </CardContent>
        </Card>
      </div>
    );
  }

  const days = latestVersion.data.days ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{plan.name}</h1>
          <Badge variant="secondary">v{latestVersion.versionNumber}</Badge>
          <Badge variant="outline">{latestVersion.data.splitType}</Badge>
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>
            <Pencil className="mr-1 h-4 w-4" />
            Edit plan text
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit workout plan</DialogTitle>
            </DialogHeader>
            <PlanEditor onSuccess={() => setEditOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Day cards */}
      <div className="space-y-4">
        {days.map((day, i) => (
          <PlanDayCard key={`${day.name}-${i}`} day={day} dayIndex={i} />
        ))}
      </div>

      {/* Version history */}
      <PlanVersionHistory versions={[latestVersion]} activeVersionId={plan.activeVersionId} />
    </div>
  );
}
