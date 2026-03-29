export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface DateRangeParams {
  startDate: string;
  endDate: string;
}

export interface CollectRequest extends DateRangeParams {
  providers?: string[];
}

export interface GenerateReportRequest extends Partial<DateRangeParams> {
  userNotes?: string;
  workoutPlan?: string;
}

export interface CollectionStatus {
  providerName: string;
  lastSuccessfulFetch: string | null;
  lastAttemptedFetch: string | null;
  recordCount: number;
  status: string;
  errorMessage: string | null;
}
