import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { collectRoutes } from './routes/collect.js';
import { nutritionRoutes } from './routes/nutrition.js';
import { measurementsRoutes } from './routes/measurements.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { workoutRoutes } from './routes/workouts.js';
import { reportRoutes } from './routes/reports.js';
import { wsReportRoutes } from './routes/ws-reports.js';
import { chatRoutes } from './routes/chat.js';
import { wsChatRoutes } from './routes/ws-chat.js';
import { uploadRoutes } from './routes/upload.js';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { databasePlugin } from './plugins/database.js';
import { registerProviders } from './services/collectors/register.js';
import type { EnvConfig } from './config/env.js';

export async function buildApp(env: EnvConfig) {
  const app = Fastify({ logger: true });

  if (env.nodeEnv === 'production' && !env.frontendUrl) {
    app.log.error('FRONTEND_URL must be set in production environment');
    throw new Error('Missing FRONTEND_URL environment variable in production');
  }
  await app.register(cors, {
    origin: env.nodeEnv === 'production' ? env.frontendUrl || false : true,
  });

  await app.register(multipart);
  await app.register(websocket);
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
  await app.register(wsReportRoutes, { env });
  await app.register(chatRoutes, { env });
  await app.register(wsChatRoutes, { env });
  await app.register(uploadRoutes, { env });

  return app;
}
