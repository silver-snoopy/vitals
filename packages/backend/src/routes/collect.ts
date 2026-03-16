import type { FastifyInstance } from 'fastify';
import type { CollectRequest, CollectionStatus } from '@vitals/shared';
import type { EnvConfig } from '../config/env.js';
import { apiKeyMiddleware } from '../middleware/api-key.js';
import { runCollection } from '../services/collectors/pipeline.js';
import { loadAllCollectionMetadata } from '../db/helpers.js';
import { validateDateRange, isDateRangeError } from '../utils/validate-dates.js';

export async function collectRoutes(app: FastifyInstance, opts: { env: EnvConfig }): Promise<void> {
  app.post<{ Body: CollectRequest }>(
    '/api/collect',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
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

      return reply.code(200).send({ success: true, data: result });
    },
  );

  app.get(
    '/api/collect/status',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (_request, reply) => {
      const rows = await loadAllCollectionMetadata(app.db, opts.env.dbDefaultUserId);
      const data: CollectionStatus[] = rows.map((r) => ({
        providerName: r.providerName,
        lastSuccessfulFetch: r.lastSuccessfulFetch?.toISOString() ?? null,
        lastAttemptedFetch: r.lastAttemptedFetch?.toISOString() ?? null,
        recordCount: r.recordCount,
        status: r.status,
        errorMessage: r.errorMessage ? 'Collection error occurred' : null,
      }));
      return reply.code(200).send({ data });
    },
  );
}
