import 'dotenv/config';

export interface EnvConfig {
  port: number;
  databaseUrl: string;
  aiProvider: string;
  anthropicApiKey: string;
  n8nApiKey: string;
  dbDefaultUserId: string;
  nodeEnv: string;
  // Cronometer credentials
  cronometerUsername: string;
  cronometerPassword: string;
  cronometerGwtHeader: string;
  cronometerGwtPermutation: string;
  // Hevy
  hevyApiKey: string;
  hevyApiBase: string;
}

export function loadEnv(): EnvConfig {
  return {
    port: parseInt(process.env.PORT || '3001', 10),
    databaseUrl: process.env.DATABASE_URL || 'postgresql://vitals:vitals@localhost:5432/vitals',
    aiProvider: process.env.AI_PROVIDER || 'claude',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    n8nApiKey: process.env.N8N_API_KEY || '',
    dbDefaultUserId: process.env.DB_DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000001',
    nodeEnv: process.env.NODE_ENV || 'development',
    cronometerUsername: process.env.CRONOMETER_USERNAME || process.env.CRON_USERNAME || '',
    cronometerPassword: process.env.CRONOMETER_PASSWORD || process.env.CRON_PASSWORD || '',
    cronometerGwtHeader: process.env.CRONOMETER_GWT_HEADER || '',
    cronometerGwtPermutation: process.env.CRONOMETER_GWT_PERMUTATION || '',
    hevyApiKey: process.env.HEVY_API_KEY || '',
    hevyApiBase: process.env.HEVY_API_BASE || 'https://api.hevyapp.com/v1',
  };
}
