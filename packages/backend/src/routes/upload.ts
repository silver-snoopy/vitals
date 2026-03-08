import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import { parseAppleHealthExport } from '../services/collectors/apple-health/parser.js';
import { ingestMeasurements, ingestWorkoutSets } from '../services/data/ingest.js';
import { refreshDailyAggregates } from '../db/helpers.js';

export async function uploadRoutes(app: FastifyInstance, opts: { env: EnvConfig }): Promise<void> {
  app.post('/api/upload/apple-health', async (request, reply) => {
    const userId = opts.env.dbDefaultUserId;
    let importId: string | null = null;

    try {
      // Read multipart file first so we can return 400 before touching the DB
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'No file uploaded. Send an XML file as multipart/form-data.',
          statusCode: 400,
        });
      }

      // Create import tracking row
      const { rows } = await app.db.query(
        `INSERT INTO apple_health_imports (user_id, filename, status)
         VALUES ($1, $2, 'processing')
         RETURNING id`,
        [userId, data.filename || 'export.xml'],
      );
      importId = String(rows[0].id);

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk as Buffer);
      }
      const xmlContent = Buffer.concat(chunks).toString('utf-8');

      // Parse and ingest
      const { measurements, workoutSets } = parseAppleHealthExport(xmlContent, userId);

      const [measResult, setsResult] = await Promise.all([
        ingestMeasurements(app.db, measurements),
        ingestWorkoutSets(app.db, workoutSets),
      ]);

      const recordCount = measResult.inserted + setsResult.inserted;

      await refreshDailyAggregates(app.db);

      // Update import as completed
      await app.db.query(
        `UPDATE apple_health_imports
         SET status = 'completed', record_count = $1, completed_at = NOW()
         WHERE id = $2`,
        [recordCount, importId],
      );

      return reply.code(200).send({
        data: { importId, recordCount, status: 'completed' },
      });
    } catch (err) {
      if (importId) {
        await app.db
          .query(
            `UPDATE apple_health_imports
           SET status = 'failed', error_message = $1
           WHERE id = $2`,
            [err instanceof Error ? err.message : String(err), importId],
          )
          .catch(() => {}); // best-effort update
      }
      throw err;
    }
  });
}
