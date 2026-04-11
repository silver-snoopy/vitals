export type ConfidenceLevel = 'high' | 'moderate' | 'suggestive';

export type CorrelationStatus = 'active' | 'weakening' | 'disproven';

export type CorrelationCategory = 'nutrition' | 'training' | 'recovery' | 'cross-domain';

export interface Correlation {
  id: string;
  userId: string;
  factorMetric: string;
  factorCondition: string;
  factorLabel: string;
  outcomeMetric: string;
  outcomeEffect: string;
  outcomeLabel: string;
  correlationCoefficient: number;
  confidenceLevel: ConfidenceLevel;
  dataPoints: number;
  pValue: number | null;
  firstDetectedAt: string;
  lastConfirmedAt: string;
  timesConfirmed: number;
  status: CorrelationStatus;
  summary: string;
  category: CorrelationCategory;
  createdAt: string;
  updatedAt: string;
}

export interface Projection {
  id: string;
  userId: string;
  metric: string;
  projectionDate: string;
  projectedValue: number;
  confidenceLow: number | null;
  confidenceHigh: number | null;
  method: 'linear_regression' | 'rolling_average' | 'exponential';
  dataPoints: number;
  generatedAt: string;
}
