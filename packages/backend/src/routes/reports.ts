import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import type { GenerateReportRequest } from '@vitals/shared';
import { apiKeyMiddleware } from '../middleware/api-key.js';
import { validateDateRange, isDateRangeError } from '../utils/validate-dates.js';
import { getReportById, listReports, createPendingReport } from '../db/queries/reports.js';
import { generateWeeklyReport } from '../services/ai/report-generator.js';
import { createAIProvider } from '../services/ai/ai-service.js';
import { runCollection } from '../services/collectors/pipeline.js';
import { runReportInBackground } from '../services/report-runner.js';

export async function reportRoutes(app: FastifyInstance, opts: { env: EnvConfig }): Promise<void> {
  app.post<{ Body: GenerateReportRequest; Querystring: { sync?: string } }>(
    '/api/reports/generate',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (request, reply) => {
      const { startDate, endDate, userNotes, workoutPlan } = request.body ?? {};
      const range = validateDateRange(startDate, endDate);

      if (isDateRangeError(range)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: range.error,
          statusCode: 400,
        });
      }

      // Validate AI provider is configured before accepting the request
      try {
        createAIProvider(opts.env);
      } catch {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'AI service is not configured. Set AI_API_KEY and AI_PROVIDER.',
          statusCode: 503,
        });
      }

      const isSync = request.query.sync === 'true';

      if (isSync) {
        // Synchronous path (backward compat for n8n/scripts)
        try {
          const collectionResult = await runCollection(app.db, {
            userId: opts.env.dbDefaultUserId,
            startDate: range.start,
            endDate: range.end,
          });
          request.log.info(
            {
              totalRecords: collectionResult.totalRecords,
              durationMs: collectionResult.durationMs,
            },
            'Pre-report data collection completed',
          );
        } catch (err: unknown) {
          request.log.warn(
            { err },
            'Pre-report data collection failed (continuing with existing data)',
          );
        }

        let report;
        try {
          report = await generateWeeklyReport(
            app.db,
            createAIProvider(opts.env),
            opts.env.dbDefaultUserId,
            range.start,
            range.end,
            userNotes,
            workoutPlan,
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          const isRateLimit = /\b429\b|rate[_ -]?limit|too many requests|quota exceeded/i.test(
            message,
          );

          if (isRateLimit) {
            return reply.code(429).send({
              error: 'Too Many Requests',
              message: 'AI service is rate limited. Please try again later.',
              statusCode: 429,
            });
          }

          request.log.error({ err }, 'Report generation failed');
          return reply.code(502).send({
            error: 'Bad Gateway',
            message: 'AI service failed to generate the report. Please try again later.',
            statusCode: 502,
          });
        }

        return reply.code(200).send({ success: true, data: report });
      }

      // Async path (default) — return immediately, generate in background
      const periodStart = range.start.toISOString().split('T')[0];
      const periodEnd = range.end.toISOString().split('T')[0];

      const reportId = await createPendingReport(app.db, {
        userId: opts.env.dbDefaultUserId,
        periodStart,
        periodEnd,
        aiProvider: opts.env.aiProvider ?? 'unknown',
      });

      runReportInBackground(app.db, opts.env, request.log, reportId, {
        userId: opts.env.dbDefaultUserId,
        startDate: range.start,
        endDate: range.end,
        userNotes,
        workoutPlan,
      });

      return reply.code(202).send({
        data: { reportId, status: 'pending' },
      });
    },
  );

  app.get('/api/reports', async (_request, reply) => {
    const reports = await listReports(app.db, opts.env.dbDefaultUserId);
    return reply.code(200).send({ data: reports });
  });

  app.get<{ Params: { id: string } }>('/api/reports/:id', async (request, reply) => {
    const report = await getReportById(app.db, request.params.id);

    if (!report) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `Report with id "${request.params.id}" not found`,
        statusCode: 404,
      });
    }

    return reply.code(200).send({ data: report });
  });
}
