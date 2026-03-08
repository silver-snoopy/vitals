import type { FastifyInstance } from 'fastify';
import type { CollectRequest } from '@vitals/shared';
import type { EnvConfig } from '../config/env.js';
import { apiKeyMiddleware } from '../middleware/api-key.js';
import { runCollection } from '../services/collectors/pipeline.js';
import { validateDateRange, isDateRangeError } from '../utils/validate-dates.js';

export async function collectRoutes(app: FastifyInstance, opts: { env: EnvConfig }): Promise<void> {
  app.post<{ Body: CollectRequest }>(
    '/api/collect',
    { preHandler: apiKeyMiddleware(opts.env.n8nApiKey) },
    async (request, reply) => {
      const { startDate, endDate, providers } = request.body ?? {};
      const range = validateDateRange(startDate, endDate);

      if (isDateRangeError(range)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: range.error,
          statusCode: 400,
        });
      }

      const result = await runCollection(app.db, {
        userId: opts.env.dbDefaultUserId,
        providers,
        startDate: range.start,
        endDate: range.end,
      });

      return reply.code(200).send({ data: result });
    },
  );
}
