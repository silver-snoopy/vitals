import { readFileSync, readdirSync } from 'fs';
import { resolve, join, basename } from 'path';
import { parse } from 'csv-parse/sync';
import { initPool, closePool } from '../src/db/pool.js';
import {
  normalizeNutritionRow,
  normalizeBiometricsRow,
  normalizeHevyRow,
} from '../src/services/data/normalizers.js';
import { ingestMeasurements, ingestWorkoutSets } from '../src/services/data/ingest.js';

const DATA_DIR = resolve(
  process.env.SEED_DATA_DIR ?? join(import.meta.dirname, '../../../data'),
);
const USER_ID = process.env.DB_DEFAULT_USER_ID ?? '00000000-0000-0000-0000-000000000001';
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://vitals:vitals@localhost:5432/vitals';

function parseCsv(text: string): Record<string, unknown>[] {
  return parse(text, { columns: true, skip_empty_lines: true }) as Record<string, unknown>[];
}

async function main(): Promise<void> {
  const pool = initPool(DATABASE_URL);
  let totalMeasurements = 0;
  let totalSets = 0;

  try {
    const files = readdirSync(DATA_DIR).sort();

    for (const file of files) {
      const filePath = join(DATA_DIR, file);
      const text = readFileSync(filePath, 'utf-8');
      const rows = parseCsv(text);
      const name = basename(file);

      if (file.startsWith('cronometer_nutrition_')) {
        const measurementRows = rows.flatMap(row =>
          normalizeNutritionRow(row, USER_ID, 'cronometer'),
        );
        const result = await ingestMeasurements(pool, measurementRows);
        totalMeasurements += result.inserted;
        console.log(`[${name}]  nutrition   ${rows.length} rows -> ${result.inserted} inserted`);
        if (result.errors.length) console.warn('  errors:', result.errors);

      } else if (file.startsWith('cronometer_biometrics_')) {
        const measurementRows = rows.flatMap(row => {
          try {
            return [normalizeBiometricsRow(row, USER_ID, 'cronometer')];
          } catch {
            return [];
          }
        });
        const result = await ingestMeasurements(pool, measurementRows);
        totalMeasurements += result.inserted;
        console.log(`[${name}]  biometric   ${rows.length} rows -> ${result.inserted} inserted`);
        if (result.errors.length) console.warn('  errors:', result.errors);

      } else if (file.startsWith('hevy_workout')) {
        const setRows = rows.map(row => normalizeHevyRow(row, USER_ID));
        const result = await ingestWorkoutSets(pool, setRows);
        totalSets += result.inserted;
        console.log(`[${name}]  workout     ${rows.length} rows -> ${result.inserted} inserted`);
        if (result.errors.length) console.warn('  errors:', result.errors);

      } else {
        console.log(`[${name}]  (skipped — unrecognised pattern)`);
      }
    }

    // Refresh materialized view
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY daily_aggregates');
    console.log('\ndaily_aggregates refreshed.');
    console.log(`\nSeed complete. Total inserted: ${totalMeasurements} measurements, ${totalSets} workout sets.`);

  } finally {
    await closePool();
  }
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
