import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import type { ReportStatusUpdate } from '@vitals/shared';
import { getReportById } from '../db/queries/reports.js';
import { reportEventBus } from '../services/report-event-bus.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function wsReportRoutes(
  app: FastifyInstance,
  opts: { env: EnvConfig },
): Promise<void> {
  app.get<{ Querystring: { reportId?: string; token?: string } }>(
    '/ws/reports',
    {
      websocket: true,
      preValidation: async (request, reply) => {
        const token = (request.query as { token?: string }).token;
        if (!token || token !== opts.env.xApiKey) {
          return reply.code(401).send({ error: 'Unauthorized', statusCode: 401 });
        }
      },
    },
    async (socket, request) => {
      const reportId = (request.query as { reportId?: string }).reportId;

      if (!reportId || !UUID_RE.test(reportId)) {
        socket.send(JSON.stringify({ error: 'Missing or invalid reportId query parameter' }));
        socket.close(1008, 'Invalid reportId');
        return;
      }

      // Subscribe FIRST to avoid race condition where the job completes
      // between the DB read and the subscribe call.
      const listener = (update: ReportStatusUpdate) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify(update));
        }

        if (update.status === 'completed' || update.status === 'failed') {
          socket.close(1000, 'Report ' + update.status);
        }
      };

      reportEventBus.subscribe(reportId, listener);

      socket.on('close', () => {
        reportEventBus.unsubscribe(reportId, listener);
      });

      // Now read current status from DB. If already terminal, send and close.
      // Any events emitted between subscribe and this read are also delivered,
      // so the client may receive duplicates — that's fine (idempotent status).
      const report = await getReportById(app.db, reportId);
      if (report) {
        const currentStatus: ReportStatusUpdate = {
          reportId,
          status: report.status ?? 'completed',
          message: report.status === 'failed' ? report.errorMessage : undefined,
        };
        socket.send(JSON.stringify(currentStatus));

        if (report.status === 'completed' || report.status === 'failed') {
          socket.close(1000, 'Report already ' + report.status);
          return;
        }
      }
    },
  );
}
