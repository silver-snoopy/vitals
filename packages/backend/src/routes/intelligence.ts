import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import type { CorrelationCategory, ConfidenceLevel, CorrelationStatus } from '@vitals/shared';
import { listCorrelations, getTopCorrelations } from '../db/queries/correlations.js';
import { getProjections } from '../db/queries/projections.js';

const MAX_TOP = 100;
const MAX_METRIC_NAME_LENGTH = 100;

interface CorrelationsQuery {
  category?: CorrelationCategory;
  confidenceLevel?: ConfidenceLevel;
  status?: CorrelationStatus;
  top?: string;
}

interface ProjectionsParams {
  metric: string;
}

export async function intelligenceRoutes(
  app: FastifyInstance,
  opts: { env: EnvConfig },
): Promise<void> {
  /**
   * GET /api/correlations
   * Returns detected correlations for the default user.
   * Optional query params: category, confidenceLevel, status, top (return top N by strength)
   */
  app.get<{ Querystring: CorrelationsQuery }>('/api/correlations', async (request, reply) => {
    const { category, confidenceLevel, status, top } = request.query;
    const userId = opts.env.dbDefaultUserId;

    if (top !== undefined) {
      const limit = parseInt(top, 10);
      if (isNaN(limit) || limit < 1) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'top must be a positive integer',
          statusCode: 400,
        });
      }
      if (limit > MAX_TOP) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: `top must be between 1 and ${MAX_TOP}`,
          statusCode: 400,
        });
      }
      const correlations = await getTopCorrelations(app.db, userId, limit);
      return reply.send({ data: correlations });
    }

    const correlations = await listCorrelations(app.db, userId, {
      category,
      confidenceLevel,
      status,
    });
    return reply.send({ data: correlations });
  });

  /**
   * GET /api/projections/:metric
   * Returns trajectory projections for a specific metric.
   */
  app.get<{ Params: ProjectionsParams }>('/api/projections/:metric', async (request, reply) => {
    const { metric } = request.params;
    const userId = opts.env.dbDefaultUserId;

    if (metric.length >= MAX_METRIC_NAME_LENGTH) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: `metric name must be fewer than ${MAX_METRIC_NAME_LENGTH} characters`,
        statusCode: 400,
      });
    }

    const projections = await getProjections(app.db, userId, metric);
    return reply.send({ data: projections });
  });
}
