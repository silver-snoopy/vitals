import type { FastifyInstance } from 'fastify';
import type { CollectRequest } from '@vitals/shared';
import type { EnvConfig } from '../config/env.js';
import { apiKeyMiddleware } from '../middleware/api-key.js';
import { runCollection } from '../services/collectors/pipeline.js';

export async function collectRoutes(
  app: FastifyInstance,
  opts: { env: EnvConfig },
): Promise<void> {
  app.post<{ Body: CollectRequest }>(
    '/api/collect',
    { preHandler: apiKeyMiddleware(opts.env.n8nApiKey) },
    async (request, reply) => {
      const { startDate, endDate, providers } = request.body ?? {};

      if (!startDate || !endDate) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'startDate and endDate are required',
          statusCode: 400,
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'startDate and endDate must be valid ISO date strings',
          statusCode: 400,
        });
      }

      if (start > end) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'startDate must be before or equal to endDate',
          statusCode: 400,
        });
      }

      const result = await runCollection(app.db, {
        userId: opts.env.dbDefaultUserId,
        providers,
        startDate: start,
        endDate: end,
      });

      return reply.code(200).send({ data: result });
    },
  );
}
