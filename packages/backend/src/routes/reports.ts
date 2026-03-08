import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import type { GenerateReportRequest } from '@vitals/shared';
import { apiKeyMiddleware } from '../middleware/api-key.js';
import { validateDateRange, isDateRangeError } from '../utils/validate-dates.js';
import { getReportById, listReports } from '../db/queries/reports.js';
import { generateWeeklyReport } from '../services/ai/report-generator.js';
import { createAIProvider } from '../services/ai/ai-service.js';

export async function reportRoutes(app: FastifyInstance, opts: { env: EnvConfig }): Promise<void> {
  app.post<{ Body: GenerateReportRequest }>(
    '/api/reports/generate',
    { preHandler: apiKeyMiddleware(opts.env.n8nApiKey) },
    async (request, reply) => {
      const { startDate, endDate } = request.body ?? {};
      const range = validateDateRange(startDate, endDate);

      if (isDateRangeError(range)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: range.error,
          statusCode: 400,
        });
      }

      let aiProvider;
      try {
        aiProvider = createAIProvider(opts.env);
      } catch {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'AI service is not configured. Set ANTHROPIC_API_KEY.',
          statusCode: 503,
        });
      }

      const report = await generateWeeklyReport(
        app.db,
        aiProvider,
        opts.env.dbDefaultUserId,
        range.start,
        range.end,
      );

      return reply.code(200).send({ data: report });
    },
  );

  app.get('/api/reports', async (request, reply) => {
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
