import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCurrentPlan, usePlanVersions } from '@/api/hooks/useWorkoutPlan';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { PlanEditor } from './PlanEditor';
import { PlanVersionCard } from './PlanVersionCard';

export function PlanPage() {
  const { data, isLoading } = useCurrentPlan();
  const [createOpen, setCreateOpen] = useState(false);

  const planResponse = data?.data;
  const plan = planResponse?.plan ?? null;

  const { data: versionsData, isLoading: versionsLoading } = usePlanVersions(plan?.id);
  const versions = versionsData?.data ?? [];

  const activeVersion = versions.find((v) => v.id === plan?.activeVersionId);
  const previousVersions = versions.filter((v) => v.id !== plan?.activeVersionId);

  const createDialog = (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create workout plan</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Paste your workout plan below. The AI will parse it into a structured format.
        </p>
        <PlanEditor onSuccess={() => setCreateOpen(false)} />
      </DialogContent>
    </Dialog>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Workout Plan</h1>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Workout Plan</h1>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No workout plan yet. Paste your training program to get started.
          </p>
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Create your first plan
          </Button>
        </div>
        {createDialog}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Workout Plan</h1>
        <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New Plan
        </Button>
      </div>

      <div className="space-y-4">
        {versionsLoading ? (
          Array.from({ length: 2 }).map((_, i) => <CardSkeleton key={i} />)
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No versions found.</p>
        ) : (
          <>
            {activeVersion && (
              <PlanVersionCard version={activeVersion} isActive={true} defaultExpanded={true} />
            )}
            {previousVersions.map((v) => (
              <PlanVersionCard key={v.id} version={v} isActive={false} />
            ))}
          </>
        )}
      </div>

      {createDialog}
    </div>
  );
}
