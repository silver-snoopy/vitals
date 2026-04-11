import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PlanAdjustmentBatch } from '@vitals/shared';
import { Button } from '@/components/ui/button';
import { useCurrentPlan, useTunePlan } from '@/api/hooks/useWorkoutPlan';
import { AdjustmentReviewModal } from '../plan/AdjustmentReviewModal';

interface OptimizePlanButtonProps {
  reportId: string;
}

/**
 * CTA button rendered inside an expanded ReportCard.
 *
 * - No plan: disabled with tooltip + link to /plan.
 * - Plan exists: enabled; on click, triggers tune and opens AdjustmentReviewModal.
 */
export function OptimizePlanButton({ reportId }: OptimizePlanButtonProps) {
  const { data: planData, isLoading: isPlanLoading } = useCurrentPlan();
  const [batch, setBatch] = useState<PlanAdjustmentBatch | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const planResponse = planData?.data;
  const plan = planResponse?.plan ?? null;

  const tunePlan = useTunePlan(plan?.id ?? '');

  if (isPlanLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (!plan) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled
          title="Create a plan to unlock"
          data-testid="optimize-disabled"
        >
          <Wand2 className="mr-2 h-4 w-4" />
          Optimize next week&apos;s plan
        </Button>
        <Link
          to="/plan"
          className="text-xs text-primary underline underline-offset-2 hover:no-underline"
        >
          Create a plan to unlock
        </Link>
      </div>
    );
  }

  const handleOptimize = () => {
    tunePlan.mutate(
      { reportId },
      {
        onSuccess: (response) => {
          setBatch(response.data);
          setModalOpen(true);
        },
        onError: (err: unknown) => {
          const msg =
            (err as { message?: string })?.message ??
            'Failed to generate plan suggestions. Try again later.';
          toast.error(msg);
        },
      },
    );
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOptimize}
        disabled={tunePlan.isPending}
        data-testid="optimize-button"
      >
        {tunePlan.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing your plan...
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-4 w-4" />
            Optimize next week&apos;s plan
          </>
        )}
      </Button>

      {batch && (
        <AdjustmentReviewModal
          batch={batch}
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setBatch(null);
          }}
        />
      )}
    </>
  );
}
