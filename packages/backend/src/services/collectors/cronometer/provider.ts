import { parse } from 'csv-parse/sync';
import type pg from 'pg';
import type { DataProvider, CollectionResult } from '@vitals/shared';
import type { CronometerClient } from './client.js';
import { normalizeNutritionRow, normalizeBiometricsRow } from '../../data/normalizers.js';
import { ingestMeasurements } from '../../data/ingest.js';
import { loadCollectionMetadata, saveCollectionMetadata } from '../../../db/helpers.js';

function parseCsv(text: string): Record<string, unknown>[] {
  return parse(text, { columns: true, skip_empty_lines: true }) as Record<string, unknown>[];
}

export class CronometerNutritionProvider implements DataProvider {
  readonly name = 'cronometer-nutrition';
  private client: CronometerClient;
  private pool: pg.Pool;
  private userId: string;

  constructor(client: CronometerClient, pool: pg.Pool, userId: string) {
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

      const csvText = await this.client.exportDailyNutrition(startDate, endDate);
      const rawRows = parseCsv(csvText);

      const measurementRows = rawRows.flatMap((row) =>
        normalizeNutritionRow(row, this.userId, 'cronometer'),
      );

      const result = await ingestMeasurements(this.pool, measurementRows);
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

export class CronometerBiometricsProvider implements DataProvider {
  readonly name = 'cronometer-biometrics';
  private client: CronometerClient;
  private pool: pg.Pool;
  private userId: string;

  constructor(client: CronometerClient, pool: pg.Pool, userId: string) {
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

      const csvText = await this.client.exportBiometrics(startDate, endDate);
      const rawRows = parseCsv(csvText);

      const measurementRows = rawRows.flatMap((row) => {
        try {
          return [normalizeBiometricsRow(row, this.userId, 'cronometer')];
        } catch {
          return [];
        }
      });

      const result = await ingestMeasurements(this.pool, measurementRows);
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
