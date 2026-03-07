import type pg from 'pg';
import type { CollectionResult } from '@vitals/shared';
import { registry } from './provider-registry.js';
import { loadCollectionMetadata, refreshDailyAggregates } from '../../db/helpers.js';

export interface PipelineOptions {
  userId: string;
  providers?: string[]; // empty = all registered
  startDate: Date;
  endDate: Date;
}

export interface PipelineResult {
  results: CollectionResult[];
  totalRecords: number;
  durationMs: number;
}

export async function runCollection(
  pool: pg.Pool,
  options: PipelineOptions,
): Promise<PipelineResult> {
  const start = Date.now();
  const { userId, startDate, endDate } = options;

  const providerNames = options.providers?.length
    ? options.providers
    : registry.names();

  const results: CollectionResult[] = [];

  for (const name of providerNames) {
    const provider = registry.get(name);
    if (!provider) {
      results.push({
        provider: name,
        recordCount: 0,
        dateRange: { start: startDate, end: endDate },
        errors: [`Provider '${name}' not registered`],
      });
      continue;
    }

    // Use last successful fetch as incremental start date if available
    const meta = await loadCollectionMetadata(pool, userId, name);
    const effectiveStart = meta?.lastSuccessfulFetch ?? startDate;

    const result = await provider.collect(effectiveStart, endDate);
    results.push(result);
  }

  if (results.some(r => r.recordCount > 0)) {
    try {
      await refreshDailyAggregates(pool);
    } catch (err) {
      // non-fatal — aggregates will be stale until next successful run
      console.warn('refreshDailyAggregates failed (non-fatal):', err instanceof Error ? err.message : err);
    }
  }

  return {
    results,
    totalRecords: results.reduce((sum, r) => sum + r.recordCount, 0),
    durationMs: Date.now() - start,
  };
}
