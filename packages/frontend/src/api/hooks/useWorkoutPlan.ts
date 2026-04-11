import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  ApiResponse,
  WorkoutPlan,
  PlanVersion,
  PlanAdjustmentBatch,
  PlanData,
  TunePlanRequest,
  CreatePlanRequest,
  DecideAdjustmentsRequest,
} from '@vitals/shared';
import { QUERY_KEYS } from '@vitals/shared';
import { apiFetch } from '../client';

/** Shape returned by GET /api/workout-plans/current */
export interface CurrentPlanResponse {
  plan: WorkoutPlan;
  latestVersion: PlanVersion;
}

/**
 * Fetches the user's current workout plan and its latest version.
 * Returns null data if the user has no plan yet.
 */
export function useCurrentPlan() {
  return useQuery({
    queryKey: QUERY_KEYS.workoutPlan.current,
    queryFn: () => apiFetch<ApiResponse<CurrentPlanResponse | null>>('/api/workout-plans/current'),
  });
}

/**
 * Creates a new workout plan from raw text or structured data.
 * Invalidates the current plan query on success.
 */
export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePlanRequest) =>
      apiFetch<ApiResponse<CurrentPlanResponse>>('/api/workout-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success('Plan created successfully');
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workoutPlan.current });
    },
  });
}

/**
 * Triggers the AI tuner for a plan.
 * Returns a PlanAdjustmentBatch ready for review.
 */
export function useTunePlan(planId: string) {
  return useMutation({
    mutationFn: (body: TunePlanRequest) =>
      apiFetch<ApiResponse<PlanAdjustmentBatch>>(`/api/workout-plans/${planId}/tune`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  });
}

/** Shape returned by PATCH /api/workout-plans/adjustments/:batchId */
interface DecideAdjustmentsResponse {
  versionNumber: number;
  data: PlanData;
  /** Present on the zero-accept path — indicates plan was not changed. */
  message?: string;
}

/**
 * Submits accept/reject decisions for an adjustment batch.
 * On success, invalidates the current plan (new version may be active).
 */
export function useDecideAdjustments(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: DecideAdjustmentsRequest) =>
      apiFetch<ApiResponse<DecideAdjustmentsResponse>>(
        `/api/workout-plans/adjustments/${batchId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      ),
    onSuccess: (response) => {
      const { versionNumber } = response.data;
      toast.success(`Plan updated to version ${versionNumber ?? 'unchanged'}`);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workoutPlan.current });
    },
  });
}
