import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { collectRoutes } from './routes/collect.js';
import { databasePlugin } from './plugins/database.js';
import { registerProviders } from './services/collectors/register.js';
import type { EnvConfig } from './config/env.js';

export async function buildApp(env: EnvConfig) {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: env.nodeEnv === 'production'
      ? process.env.FRONTEND_URL || ''
      : true,
  });

  await app.register(databasePlugin, { env });

  // Register data providers after DB is ready
  app.addHook('onReady', async () => {
    registerProviders(app.db, env);
  });

  await app.register(healthRoutes);
  await app.register(collectRoutes, { env });

  return app;
}
