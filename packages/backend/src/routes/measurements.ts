import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import { validateDateRange, isDateRangeError } from '../utils/validate-dates.js';
import { queryMeasurementsByMetric } from '../db/queries/measurements.js';

export async function measurementsRoutes(
  app: FastifyInstance,
  opts: { env: EnvConfig },
): Promise<void> {
  app.get<{ Querystring: { metric?: string; startDate?: string; endDate?: string } }>(
    '/api/measurements',
    async (request, reply) => {
      const { metric, startDate, endDate } = request.query;

      if (!metric) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'metric is required',
          statusCode: 400,
        });
      }

      const range = validateDateRange(startDate, endDate);

      if (isDateRangeError(range)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: range.error,
          statusCode: 400,
        });
      }

      const data = await queryMeasurementsByMetric(
        app.db,
        opts.env.dbDefaultUserId,
        metric,
        range.start,
        range.end,
      );

      return reply.code(200).send({ data });
    },
  );
}
