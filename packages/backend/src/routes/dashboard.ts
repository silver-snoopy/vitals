import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import { validateDateRange, isDateRangeError } from '../utils/validate-dates.js';
import {
  queryDailyNutritionSummary,
  queryMeasurementsByMetric,
} from '../db/queries/measurements.js';
import { queryWorkoutSessions } from '../db/queries/workouts.js';

export async function dashboardRoutes(
  app: FastifyInstance,
  opts: { env: EnvConfig },
): Promise<void> {
  app.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    '/api/dashboard/weekly',
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

      const userId = opts.env.dbDefaultUserId;

      const [nutrition, workouts, biometrics] = await Promise.all([
        queryDailyNutritionSummary(app.db, userId, range.start, range.end),
        queryWorkoutSessions(app.db, userId, range.start, range.end),
        queryMeasurementsByMetric(app.db, userId, 'weight_kg', range.start, range.end),
      ]);

      return reply.code(200).send({
        data: { nutrition, workouts, biometrics },
      });
    },
  );
}
