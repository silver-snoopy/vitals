import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import type { ReportStatusUpdate } from '@vitals/shared';
import { getReportById } from '../db/queries/reports.js';
import { reportEventBus } from '../services/report-event-bus.js';
import { isValidUuid } from '../utils/uuid.js';

export async function wsReportRoutes(
  app: FastifyInstance,
  opts: { env: EnvConfig },
): Promise<void> {
  app.get<{ Querystring: { reportId?: string; token?: string } }>(
    '/ws/reports',
    { websocket: true },
    async (socket, request) => {
      // Auth check inside handler — preValidation reply.code() breaks WS upgrades.
      // Match apiKeyMiddleware: skip auth when no key is configured (dev mode).
      if (opts.env.xApiKey) {
        const token = (request.query as { token?: string }).token;
        if (!token || token !== opts.env.xApiKey) {
          socket.send(JSON.stringify({ error: 'Unauthorized' }));
          socket.close(1008, 'Unauthorized');
          return;
        }
      }

      const reportId = (request.query as { reportId?: string }).reportId;

      if (!reportId || !isValidUuid(reportId)) {
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
