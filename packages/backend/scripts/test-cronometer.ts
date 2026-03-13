import 'dotenv/config';
import { CronometerGwtClient } from '../src/services/collectors/cronometer/client.js';

async function main() {
  const { CRONOMETER_USERNAME, CRONOMETER_PASSWORD, CRONOMETER_GWT_HEADER, CRONOMETER_GWT_PERMUTATION } =
    process.env;

  if (!CRONOMETER_USERNAME || !CRONOMETER_PASSWORD) {
    console.error('Missing CRONOMETER_USERNAME or CRONOMETER_PASSWORD in .env');
    process.exit(1);
  }
  if (!CRONOMETER_GWT_HEADER || !CRONOMETER_GWT_PERMUTATION) {
    console.error('Missing CRONOMETER_GWT_HEADER or CRONOMETER_GWT_PERMUTATION in .env');
    process.exit(1);
  }

  const client = new CronometerGwtClient(
    CRONOMETER_USERNAME,
    CRONOMETER_PASSWORD,
    CRONOMETER_GWT_HEADER,
    CRONOMETER_GWT_PERMUTATION,
  );

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  console.log(`Testing Cronometer export for ${yesterday.toISOString().slice(0, 10)}...`);

  try {
    const csv = await client.exportDailyNutrition(yesterday, yesterday);
    const lines = csv.split('\n').filter(Boolean);
    console.log(`Success! Got ${lines.length} lines:`);
    lines.slice(0, 5).forEach((line) => console.log(`  ${line}`));
    if (lines.length > 5) console.log(`  ... and ${lines.length - 5} more`);
  } catch (err) {
    console.error('Cronometer test FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
