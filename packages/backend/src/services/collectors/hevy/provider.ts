import type pg from 'pg';
import type { DataProvider, CollectionResult } from '@vitals/shared';
import type { HevyClient } from './client.js';
import { normalizeHevyRow } from '../../data/normalizers.js';
import { ingestWorkoutSets } from '../../data/ingest.js';
import { loadCollectionMetadata, saveCollectionMetadata } from '../../../db/helpers.js';

export class HevyProvider implements DataProvider {
  readonly name = 'hevy';
  private client: HevyClient;
  private pool: pg.Pool;
  private userId: string;

  constructor(client: HevyClient, pool: pg.Pool, userId: string) {
    this.client = client;
    this.pool = pool;
    this.userId = userId;
  }

  async collect(startDate: Date, endDate: Date): Promise<CollectionResult> {
    const errors: string[] = [];
    let recordCount = 0;

    const previousMeta = await loadCollectionMetadata(this.pool, this.userId, this.name);

    try {
      await saveCollectionMetadata(this.pool, {
        userId: this.userId,
        providerName: this.name,
        lastSuccessfulFetch: previousMeta?.lastSuccessfulFetch ?? null,
        lastAttemptedFetch: new Date(),
        recordCount: 0,
        status: 'running',
        errorMessage: null,
      });

      const rawRows = await this.client.fetchWorkouts(startDate, endDate);
      const setRows = rawRows.map(row => normalizeHevyRow(row, this.userId));

      const result = await ingestWorkoutSets(this.pool, setRows);
      recordCount = result.inserted;
      errors.push(...result.errors);

      await saveCollectionMetadata(this.pool, {
        userId: this.userId,
        providerName: this.name,
        lastSuccessfulFetch: new Date(),
        lastAttemptedFetch: new Date(),
        recordCount,
        status: 'success',
        errorMessage: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      await saveCollectionMetadata(this.pool, {
        userId: this.userId,
        providerName: this.name,
        lastSuccessfulFetch: previousMeta?.lastSuccessfulFetch ?? null,
        lastAttemptedFetch: new Date(),
        recordCount: 0,
        status: 'error',
        errorMessage: message,
      });
    }

    return {
      provider: this.name,
      recordCount,
      dateRange: { start: startDate, end: endDate },
      errors,
    };
  }
}
