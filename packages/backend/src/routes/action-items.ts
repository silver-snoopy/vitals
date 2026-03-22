import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import type { ActionItemStatus } from '@vitals/shared';
import { apiKeyMiddleware } from '../middleware/api-key.js';
import {
  listActionItems,
  getActionItem,
  updateActionItemStatus,
  getActionItemSummary,
  getAttributionSummary,
} from '../db/queries/action-items.js';

const DEFAULT_USER_ID = 'default';

export async function actionItemRoutes(
  app: FastifyInstance,
  opts: { env: EnvConfig },
): Promise<void> {
  // GET /api/action-items/summary — must be registered before /:id route
  app.get(
    '/api/action-items/summary',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (_request, reply) => {
      const summary = await getActionItemSummary(app.db, DEFAULT_USER_ID);
      return reply.send({ data: summary });
    },
  );

  // GET /api/action-items/attribution
  app.get<{
    Querystring: { period?: string };
  }>(
    '/api/action-items/attribution',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (request, reply) => {
      const period = (request.query.period ?? 'month') as 'week' | 'month' | 'quarter';
      const validPeriods = ['week', 'month', 'quarter'];
      const safePeriod = validPeriods.includes(period) ? period : 'month';
      const summary = await getAttributionSummary(app.db, DEFAULT_USER_ID, safePeriod);
      return reply.send({ data: summary });
    },
  );

  // GET /api/action-items
  app.get<{
    Querystring: { status?: string; category?: string; reportId?: string; limit?: string };
  }>(
    '/api/action-items',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (request, reply) => {
      const { status, category, reportId, limit } = request.query;

      const statusFilter = status
        ? (status.split(',').filter(Boolean) as ActionItemStatus[])
        : undefined;

      const items = await listActionItems(app.db, DEFAULT_USER_ID, {
        status: statusFilter,
        category,
        reportId,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      return reply.send({ data: items });
    },
  );

  // GET /api/action-items/:id
  app.get<{ Params: { id: string } }>(
    '/api/action-items/:id',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (request, reply) => {
      const item = await getActionItem(app.db, request.params.id, DEFAULT_USER_ID);
      if (!item) {
        return reply.code(404).send({ error: 'Not Found', statusCode: 404 });
      }
      return reply.send({ data: item });
    },
  );

  // PATCH /api/action-items/:id/status
  app.patch<{ Params: { id: string }; Body: { status: ActionItemStatus; dueBy?: string } }>(
    '/api/action-items/:id/status',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (request, reply) => {
      const { status, dueBy } = request.body ?? {};

      if (!status) {
        return reply
          .code(400)
          .send({ error: 'Bad Request', message: 'status is required', statusCode: 400 });
      }

      try {
        const updated = await updateActionItemStatus(
          app.db,
          request.params.id,
          DEFAULT_USER_ID,
          status,
          dueBy,
        );

        if (!updated) {
          return reply.code(404).send({ error: 'Not Found', statusCode: 404 });
        }

        return reply.send({ data: updated });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Invalid status transition';
        return reply.code(400).send({ error: 'Bad Request', message, statusCode: 400 });
      }
    },
  );
}
