import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { collectRoutes } from './routes/collect.js';
import { nutritionRoutes } from './routes/nutrition.js';
import { measurementsRoutes } from './routes/measurements.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { workoutRoutes } from './routes/workouts.js';
import { reportRoutes } from './routes/reports.js';
import { uploadRoutes } from './routes/upload.js';
import multipart from '@fastify/multipart';
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

  await app.register(multipart);
  await app.register(databasePlugin, { env });

  // Register data providers after DB is ready
  app.addHook('onReady', async () => {
    registerProviders(app.db, env);
  });

  await app.register(healthRoutes);
  await app.register(collectRoutes, { env });
  await app.register(nutritionRoutes, { env });
  await app.register(measurementsRoutes, { env });
  await app.register(dashboardRoutes, { env });
  await app.register(workoutRoutes, { env });
  await app.register(reportRoutes, { env });
  await app.register(uploadRoutes, { env });

  return app;
}
