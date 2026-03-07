import type pg from 'pg';
import type { EnvConfig } from '../../config/env.js';
import { registry } from './provider-registry.js';
import { CronometerGwtClient } from './cronometer/client.js';
import { CronometerNutritionProvider, CronometerBiometricsProvider } from './cronometer/provider.js';
import { HevyApiClient } from './hevy/client.js';
import { HevyProvider } from './hevy/provider.js';

export function registerProviders(pool: pg.Pool, env: EnvConfig): void {
  const userId = env.dbDefaultUserId;

  if (env.cronometerUsername && env.cronometerPassword) {
    const cronometerClient = new CronometerGwtClient(
      env.cronometerUsername,
      env.cronometerPassword,
      env.cronometerGwtHeader,
      env.cronometerGwtPermutation,
    );
    registry.register(new CronometerNutritionProvider(cronometerClient, pool, userId));
    registry.register(new CronometerBiometricsProvider(cronometerClient, pool, userId));
  }

  if (env.hevyApiKey) {
    const hevyClient = new HevyApiClient(env.hevyApiKey, env.hevyApiBase);
    registry.register(new HevyProvider(hevyClient, pool, userId));
  }
}
