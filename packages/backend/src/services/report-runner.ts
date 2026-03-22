import type pg from 'pg';
import type { FastifyBaseLogger } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import type { ReportStatusUpdate } from '@vitals/shared';
import { updateReportStatus, completeReport, logAiGeneration } from '../db/queries/reports.js';
import { promoteActionItems } from '../db/queries/action-items.js';
import { gatherAndGenerate } from './ai/report-generator.js';
import { createAIProvider } from './ai/ai-service.js';
import { runCollection } from './collectors/pipeline.js';
import { reportEventBus } from './report-event-bus.js';

function emitStatus(
  reportId: string,
  status: ReportStatusUpdate['status'],
  message?: string,
): void {
  reportEventBus.emit(reportId, { reportId, status, message });
}

export function runReportInBackground(
  pool: pg.Pool,
  env: EnvConfig,
  log: FastifyBaseLogger,
  reportId: string,
  params: {
    userId: string;
    startDate: Date;
    endDate: Date;
    userNotes?: string;
    workoutPlan?: string;
  },
): void {
  // Fire-and-forget — errors are caught internally
  void (async () => {
    try {
      // Phase 1: Collect data
      await updateReportStatus(pool, reportId, 'collecting_data');
      emitStatus(reportId, 'collecting_data', 'Collecting latest health data...');

      try {
        await runCollection(pool, {
          userId: params.userId,
          startDate: params.startDate,
          endDate: params.endDate,
        });
      } catch (err: unknown) {
        log.warn({ err }, 'Pre-report data collection failed (continuing with existing data)');
      }

      // Phase 2: Generate with AI
      await updateReportStatus(pool, reportId, 'generating');
      emitStatus(reportId, 'generating', 'Generating AI insights...');

      const aiProvider = createAIProvider(env);
      const gen = await gatherAndGenerate(
        pool,
        aiProvider,
        params.userId,
        params.startDate,
        params.endDate,
        params.userNotes,
        params.workoutPlan,
      );

      // Phase 3: Save completed report
      await completeReport(pool, reportId, {
        summary: gen.summary,
        insights: gen.insights,
        actionItems: gen.actionItems,
        dataCoverage: gen.dataCoverage,
        sections: gen.sections,
        aiProvider: gen.providerName,
        aiModel: gen.model,
      });

      await logAiGeneration(pool, {
        userId: params.userId,
        provider: gen.providerName,
        model: gen.model,
        promptTokens: gen.usage.promptTokens,
        completionTokens: gen.usage.completionTokens,
        totalTokens: gen.usage.totalTokens,
        purpose: 'weekly_report',
      });

      // Promote action items to persistent tracked entities
      if (gen.actionItems.length > 0) {
        await promoteActionItems(pool, params.userId, reportId, gen.actionItems);
      }

      emitStatus(reportId, 'completed', 'Report ready');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err, reportId }, 'Background report generation failed');

      try {
        await updateReportStatus(pool, reportId, 'failed', message);
      } catch (dbErr: unknown) {
        log.error({ dbErr, reportId }, 'Failed to update report status to failed');
      }

      emitStatus(reportId, 'failed', message);
    }
  })();
}
