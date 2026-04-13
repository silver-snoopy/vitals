import type { FastifyInstance } from 'fastify';
import type { EnvConfig } from '../config/env.js';
import type {
  CreatePlanRequest,
  TunePlanRequest,
  DecideAdjustmentsRequest,
  PlanData,
  PlanSet,
  PlanAdjustmentBatch,
  AIProvider,
} from '@vitals/shared';
import { apiKeyMiddleware } from '../middleware/api-key.js';
import {
  getCurrentPlan,
  getPlanById,
  getPlanVersion,
  upsertPlan,
  insertPlanVersion,
  listPlanVersions,
  getAdjustmentBatch,
  bulkUpdateAdjustmentStatus,
} from '../db/queries/workout-plans.js';
import { parseFreeTextPlan } from '../services/workout-plans/plan-parser.js';
import { tunePlan } from '../services/workout-plans/tuner.js';
import { createAIProvider } from '../services/ai/ai-service.js';

const VALID_SET_TYPES = new Set(['warmup', 'normal', 'drop', 'failure', 'amrap']);

/** Validate that a value is a well-formed PlanSet array (guards overrideValue from client). */
function isValidPlanSetArray(v: unknown): v is PlanSet[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > 20) return false;
  return v.every((s) => {
    if (s === null || typeof s !== 'object') return false;
    const set = s as Record<string, unknown>;
    if (!VALID_SET_TYPES.has(set.type as string)) return false;
    const reps = set.targetReps;
    if (typeof reps !== 'number' && !Array.isArray(reps)) return false;
    if (
      Array.isArray(reps) &&
      (reps.length !== 2 || typeof reps[0] !== 'number' || typeof reps[1] !== 'number')
    )
      return false;
    if (set.targetWeightKg !== undefined && typeof set.targetWeightKg !== 'number') return false;
    if (set.targetRpe !== undefined && typeof set.targetRpe !== 'number') return false;
    if (set.restSec !== undefined && typeof set.restSec !== 'number') return false;
    return true;
  });
}

/**
 * Workout Plan Fine Tuner routes.
 *
 * Endpoints:
 *   POST   /api/workout-plans                        Create plan (API key)
 *   GET    /api/workout-plans/current                Get current plan + latest version
 *   GET    /api/workout-plans/:id/versions           List all versions for a plan
 *   GET    /api/workout-plans/versions/:versionId    Get a single version
 *   PUT    /api/workout-plans/:id                    Replace plan content (API key)
 *   POST   /api/workout-plans/:id/tune               Trigger AI tuner (API key)
 *   PATCH  /api/workout-plans/adjustments/:batchId   Accept/reject per-change decisions (API key)
 */
export async function workoutPlanRoutes(
  app: FastifyInstance,
  opts: { env: EnvConfig },
): Promise<void> {
  // POST /api/workout-plans — parse and create a new plan
  app.post<{ Body: CreatePlanRequest }>(
    '/api/workout-plans',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (request, reply) => {
      const { rawText, plan: planBody } = request.body ?? {};

      // Hard cap on rawText size to prevent DoS of the parser and limit stored health data
      const RAW_TEXT_MAX_CHARS = 50_000;
      if (rawText && rawText.length > RAW_TEXT_MAX_CHARS) {
        return reply.code(413).send({
          error: 'Payload Too Large',
          message: 'Plan text too large',
          statusCode: 413,
        });
      }

      let planData: PlanData;
      if (planBody?.activeVersionId !== undefined) {
        // Pre-structured plan provided — validate and use directly
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Use rawText to create a plan from free text.',
          statusCode: 400,
        });
      } else if (rawText) {
        let aiProvider: AIProvider | undefined;
        try {
          aiProvider = createAIProvider(opts.env);
        } catch {
          // AI not configured — regex fallback will be used
        }
        planData = await parseFreeTextPlan(rawText, aiProvider);
      } else {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Either rawText or plan must be provided.',
          statusCode: 400,
        });
      }

      const plan = await upsertPlan(app.db, opts.env.dbDefaultUserId, {
        name: 'My Workout Plan',
        splitType: planData.splitType,
      });

      const version = await insertPlanVersion(app.db, plan.id, {
        source: 'user',
        parentVersionId: null,
        data: planData,
        notes: rawText ? 'Created from free text' : undefined,
      });

      return reply.code(201).send({ data: { plan, version } });
    },
  );

  // GET /api/workout-plans/current — return current plan + latest version, or null
  // NOTE: must be registered before /:id to avoid route conflict
  app.get('/api/workout-plans/current', async (_request, reply) => {
    const result = await getCurrentPlan(app.db, opts.env.dbDefaultUserId);
    return reply.code(200).send({ data: result ?? null });
  });

  // GET /api/workout-plans/versions/:versionId — single version
  // NOTE: must be registered before /:id/versions to avoid conflict
  app.get<{ Params: { versionId: string } }>(
    '/api/workout-plans/versions/:versionId',
    async (request, reply) => {
      const version = await getPlanVersion(app.db, request.params.versionId);
      if (!version) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Plan version "${request.params.versionId}" not found`,
          statusCode: 404,
        });
      }
      return reply.code(200).send({ data: version });
    },
  );

  // GET /api/workout-plans/:id/versions — list all versions for a plan
  app.get<{ Params: { id: string } }>('/api/workout-plans/:id/versions', async (request, reply) => {
    const plan = await getPlanById(app.db, request.params.id);
    if (!plan) {
      return reply.code(404).send({
        error: 'Not Found',
        message: `Plan "${request.params.id}" not found`,
        statusCode: 404,
      });
    }
    const versions = await listPlanVersions(app.db, request.params.id);
    return reply.code(200).send({ data: versions });
  });

  // PUT /api/workout-plans/:id — replace plan (creates new user version)
  app.put<{ Params: { id: string }; Body: CreatePlanRequest }>(
    '/api/workout-plans/:id',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (request, reply) => {
      const plan = await getPlanById(app.db, request.params.id);
      if (!plan) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Plan "${request.params.id}" not found`,
          statusCode: 404,
        });
      }

      const { rawText } = request.body ?? {};
      if (!rawText) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'rawText is required',
          statusCode: 400,
        });
      }

      const RAW_TEXT_MAX_CHARS = 50_000;
      if (rawText.length > RAW_TEXT_MAX_CHARS) {
        return reply.code(413).send({
          error: 'Payload Too Large',
          message: 'Plan text too large',
          statusCode: 413,
        });
      }

      let aiProvider: AIProvider | undefined;
      try {
        aiProvider = createAIProvider(opts.env);
      } catch {
        // AI not configured — regex fallback will be used
      }
      const planData = await parseFreeTextPlan(rawText, aiProvider);
      const version = await insertPlanVersion(app.db, plan.id, {
        source: 'user',
        parentVersionId: plan.activeVersionId,
        data: planData,
        notes: 'Updated from free text',
      });

      return reply.code(200).send({ data: { plan, version } });
    },
  );

  // POST /api/workout-plans/:id/tune — trigger AI tuner
  app.post<{ Params: { id: string }; Body: TunePlanRequest }>(
    '/api/workout-plans/:id/tune',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (request, reply) => {
      const { reportId } = request.body ?? {};
      if (!reportId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'reportId is required',
          statusCode: 400,
        });
      }

      const plan = await getPlanById(app.db, request.params.id);
      if (!plan) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Plan "${request.params.id}" not found`,
          statusCode: 404,
        });
      }

      if (!plan.activeVersionId) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Plan has no active version. Create a version first.',
          statusCode: 400,
        });
      }

      let aiProvider: AIProvider;
      try {
        aiProvider = createAIProvider(opts.env);
      } catch {
        return reply.code(503).send({
          error: 'Service Unavailable',
          message: 'AI service is not configured. Set AI_API_KEY and AI_PROVIDER.',
          statusCode: 503,
        });
      }

      let batch: PlanAdjustmentBatch;
      try {
        batch = await tunePlan(
          app.db,
          aiProvider,
          opts.env.dbDefaultUserId,
          plan.activeVersionId,
          reportId,
        );
      } catch (err: unknown) {
        if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'NOT_FOUND') {
          return reply.code(404).send({
            error: 'Not Found',
            message: err.message,
            statusCode: 404,
          });
        }

        const message = err instanceof Error ? err.message : String(err);
        const isRateLimit = /\b429\b|rate[_ -]?limit|too many requests|quota exceeded/i.test(
          message,
        );

        if (isRateLimit) {
          return reply.code(429).send({
            error: 'Too Many Requests',
            message: 'AI service is rate limited. Please try again later.',
            statusCode: 429,
          });
        }

        // Avoid logging the full prompt — only log planId and error message
        const planId = request.params.id;
        const errMsg = err instanceof Error ? err.message : String(err);
        request.log.error({ planId, errMsg }, 'Plan tuner failed');
        return reply.code(502).send({
          error: 'Bad Gateway',
          message: 'AI service failed to generate the plan adjustment. Please try again later.',
          statusCode: 502,
        });
      }

      return reply.code(200).send({ data: batch });
    },
  );

  // PATCH /api/workout-plans/adjustments/:batchId — accept/reject per-change decisions
  app.patch<{ Params: { batchId: string }; Body: DecideAdjustmentsRequest }>(
    '/api/workout-plans/adjustments/:batchId',
    { preHandler: apiKeyMiddleware(opts.env.xApiKey) },
    async (request, reply) => {
      const { decisions } = request.body ?? {};

      if (!decisions || Object.keys(decisions).length === 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'decisions map is required and must not be empty',
          statusCode: 400,
        });
      }

      const batch = await getAdjustmentBatch(app.db, request.params.batchId);
      if (!batch) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Adjustment batch "${request.params.batchId}" not found`,
          statusCode: 404,
        });
      }

      // Verify the source version exists BEFORE committing any status updates.
      // If the source version is missing, we must not mutate adjustment statuses.
      const sourceVersion = await getPlanVersion(app.db, batch.sourceVersionId);
      if (!sourceVersion) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Source version "${batch.sourceVersionId}" not found`,
          statusCode: 404,
        });
      }

      const invalidDecisions = Object.entries(decisions).filter(
        ([, d]) => !d || !['accepted', 'rejected'].includes(d.status),
      );
      if (invalidDecisions.length > 0) {
        return reply.code(400).send({
          error: 'Each decision must have a status of "accepted" or "rejected"',
        });
      }

      // Map AdjustmentDecision objects to plain status strings for DB
      const statusMap: Record<string, 'accepted' | 'rejected'> = {};
      for (const [id, decision] of Object.entries(decisions)) {
        statusMap[id] = decision.status;
      }
      await bulkUpdateAdjustmentStatus(app.db, request.params.batchId, statusMap);

      const acceptedAdjustments = batch.adjustments.filter(
        (adj) => decisions[adj.id]?.status === 'accepted',
      );

      if (acceptedAdjustments.length === 0) {
        // No accepted changes — return source version details
        return reply.code(200).send({
          data: {
            versionNumber: sourceVersion.versionNumber,
            data: sourceVersion.data,
            message: 'No changes accepted; plan unchanged.',
          },
        });
      }

      // Apply accepted changes to produce new PlanData
      const newPlanData: PlanData = JSON.parse(JSON.stringify(sourceVersion.data)) as PlanData;

      for (const adj of acceptedAdjustments) {
        const day = newPlanData.days[adj.exerciseRef.dayIndex];
        if (!day) continue;
        const exercise = day.exercises.find((e) => e.orderInDay === adj.exerciseRef.exerciseOrder);
        if (!exercise) continue;

        if (
          adj.changeType === 'progress_load' ||
          adj.changeType === 'progress_reps' ||
          adj.changeType === 'deload' ||
          adj.changeType === 'hold'
        ) {
          const decision = decisions[adj.id];
          const effectiveValue = decision?.overrideValue ?? adj.newValue;
          if (Array.isArray(effectiveValue) && isValidPlanSetArray(effectiveValue)) {
            exercise.sets = effectiveValue;
          } else if (Array.isArray(effectiveValue)) {
            // Fallback: ignore invalid override, use AI's original value
            if (Array.isArray(adj.newValue)) {
              exercise.sets = adj.newValue as PlanSet[];
            }
          }
        }
      }

      // Insert new plan version
      const newVersion = await insertPlanVersion(app.db, batch.planId, {
        source: 'tuner',
        parentVersionId: sourceVersion.id,
        data: newPlanData,
        notes: `Accepted ${acceptedAdjustments.length} adjustment(s) from batch ${batch.id}`,
      });

      return reply.code(200).send({
        data: {
          versionNumber: newVersion.versionNumber,
          data: newVersion.data,
        },
      });
    },
  );
}
