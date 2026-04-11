import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCreatePlan } from '@/api/hooks/useWorkoutPlan';

interface PlanEditorProps {
  initialText?: string;
  onSuccess?: () => void;
}

const PLACEHOLDER = `Paste your workout plan here. Example:

Push Day
Bench Press 3×8-12 @ 70kg
Overhead Press 3×8-10 @ 50kg
Tricep Pushdown 3×12-15

Pull Day
Barbell Row 3×8-10 @ 80kg
Pull-ups 3×6-10
Bicep Curl 3×10-12`;

/**
 * PlanEditor — paste textarea + submit.
 * Shows loading state while the parser/AI runs.
 */
export function PlanEditor({ initialText = '', onSuccess }: PlanEditorProps) {
  const [rawText, setRawText] = useState(initialText);
  const createPlan = useCreatePlan();

  const handleSubmit = () => {
    createPlan.mutate(
      { rawText },
      {
        onSuccess: () => {
          onSuccess?.();
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={10}
        disabled={createPlan.isPending}
        aria-label="Paste your plan"
        data-testid="plan-textarea"
      />

      {createPlan.error && (
        <p className="text-sm text-destructive" role="alert">
          {(createPlan.error as { message?: string })?.message ??
            'Failed to parse plan. Please try again.'}
        </p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={createPlan.isPending || rawText.trim().length === 0}
        className="w-full sm:w-auto"
      >
        {createPlan.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Parsing your plan...
          </>
        ) : (
          'Parse & Save'
        )}
      </Button>
    </div>
  );
}
