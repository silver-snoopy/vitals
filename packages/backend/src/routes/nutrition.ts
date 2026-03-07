import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import { validateDateRange, isDateRangeError } from '../utils/validate-dates.js';
import { queryDailyNutritionSummary } from '../db/queries/measurements.js';

export async function nutritionRoutes(
  app: FastifyInstance,
  opts: { env: EnvConfig },
): Promise<void> {
  app.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    '/api/nutrition/daily',
    async (request, reply) => {
      const { startDate, endDate } = request.query;
      const range = validateDateRange(startDate, endDate);

      if (isDateRangeError(range)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: range.error,
          statusCode: 400,
        });
      }

      const data = await queryDailyNutritionSummary(
        app.db,
        opts.env.dbDefaultUserId,
        range.start,
        range.end,
      );

      return reply.code(200).send({ data });
    },
  );
}
