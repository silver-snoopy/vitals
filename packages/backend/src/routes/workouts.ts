import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import { validateDateRange, isDateRangeError } from '../utils/validate-dates.js';
import { queryWorkoutSessions, queryExerciseProgress } from '../db/queries/workouts.js';

export async function workoutRoutes(app: FastifyInstance, opts: { env: EnvConfig }): Promise<void> {
  app.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    '/api/workouts',
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

      const data = await queryWorkoutSessions(
        app.db,
        opts.env.dbDefaultUserId,
        range.start,
        range.end,
      );

      return reply.code(200).send({ data });
    },
  );

  app.get<{ Params: { exerciseName: string } }>(
    '/api/workouts/progress/:exerciseName',
    async (request, reply) => {
      const exerciseName = decodeURIComponent(request.params.exerciseName);

      const data = await queryExerciseProgress(app.db, opts.env.dbDefaultUserId, exerciseName);

      return reply.code(200).send({ data });
    },
  );
}
