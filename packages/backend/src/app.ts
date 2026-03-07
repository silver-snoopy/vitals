import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { databasePlugin } from './plugins/database.js';
import type { EnvConfig } from './config/env.js';

export async function buildApp(env: EnvConfig) {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: env.nodeEnv === 'production'
      ? process.env.FRONTEND_URL || ''
      : true,
  });

  await app.register(databasePlugin, { env });

  await app.register(healthRoutes);

  return app;
}
