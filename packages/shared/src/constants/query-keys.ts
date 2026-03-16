export const QUERY_KEYS = {
  nutrition: {
    all: ['nutrition'] as const,
    daily: (start: string, end: string) => ['nutrition', 'daily', start, end] as const,
  },
  workouts: {
    all: ['workouts'] as const,
    sessions: (start: string, end: string) => ['workouts', 'sessions', start, end] as const,
    progress: (exercise: string) => ['workouts', 'progress', exercise] as const,
  },
  reports: {
    all: ['reports'] as const,
    latest: ['reports', 'latest'] as const,
    byId: (id: string) => ['reports', id] as const,
  },
  measurements: {
    all: ['measurements'] as const,
    byMetric: (metric: string) => ['measurements', metric] as const,
  },
  dashboard: {
    weekly: (start: string, end: string) => ['dashboard', 'weekly', start, end] as const,
  },
  collection: {
    status: ['collection', 'status'] as const,
  },
} as const;
