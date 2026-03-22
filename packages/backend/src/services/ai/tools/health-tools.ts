import type { AITool } from '@vitals/shared';

const dateRangeProperties = {
  startDate: {
    type: 'string',
    description: 'Start date in ISO 8601 format (e.g. 2026-03-01). Inclusive.',
  },
  endDate: {
    type: 'string',
    description: 'End date in ISO 8601 format (e.g. 2026-03-14). Inclusive.',
  },
};

export const HEALTH_TOOLS: AITool[] = [
  {
    name: 'query_nutrition',
    description:
      'Query daily nutrition summaries (calories, protein, carbs, fat, fibre, and micronutrients) for a date range. Use this to answer questions about diet, macros, calorie intake, or food logging.',
    inputSchema: {
      type: 'object',
      properties: dateRangeProperties,
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'query_workouts',
    description:
      'Query workout sessions including exercises, sets, reps, weight, and volume for a date range. Use this for questions about training history, exercise frequency, or workout performance.',
    inputSchema: {
      type: 'object',
      properties: dateRangeProperties,
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'query_biometrics',
    description:
      'Query biometric measurements (e.g. body_weight_kg, body_fat_percent, hrv_rmssd, resting_heart_rate) for specific metrics over a date range. Use this for weight trends, body composition changes, or vital signs.',
    inputSchema: {
      type: 'object',
      properties: {
        metrics: {
          type: 'array',
          items: { type: 'string' },
          description:
            'List of metric names to query, e.g. ["body_weight_kg", "body_fat_percent"]. Use list_available_metrics to discover valid names.',
        },
        ...dateRangeProperties,
      },
      required: ['metrics', 'startDate', 'endDate'],
    },
  },
  {
    name: 'query_exercise_progress',
    description:
      'Query progress for a specific exercise over time — best set, total volume, and average weight by date. Use this to answer questions about strength progression on a particular lift.',
    inputSchema: {
      type: 'object',
      properties: {
        exerciseName: {
          type: 'string',
          description: 'Exact exercise name as logged (e.g. "Barbell Back Squat").',
        },
        ...dateRangeProperties,
      },
      required: ['exerciseName'],
    },
  },
  {
    name: 'get_latest_report',
    description:
      'Retrieve the most recent weekly AI health report. Use this when the user asks about their last report, recent summary, or wants context from a previous analysis.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'query_action_items',
    description:
      "Query the user's tracked action items from weekly reports. Can filter by status (pending, active, completed, deferred, expired) and category (nutrition, workout, recovery, general). Use this when the user asks about their action items, tasks, or recommendations from reports.",
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'active', 'completed', 'deferred', 'expired', 'all'],
          description: 'Filter by status. Default: "active" to show current items.',
        },
        category: {
          type: 'string',
          enum: ['nutrition', 'workout', 'recovery', 'general'],
          description: 'Filter by category. Omit to show all categories.',
        },
        limit: {
          type: 'number',
          description: 'Max items to return. Default: 20.',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_action_outcomes',
    description:
      'Query outcome measurements for completed action items. Shows whether target metrics improved after the user completed recommended actions. Use this when the user asks about results, impact, or effectiveness of their actions.',
    inputSchema: {
      type: 'object',
      properties: {
        actionItemId: {
          type: 'string',
          description:
            'Specific action item ID to measure outcome for. If provided, generates a fresh snapshot.',
        },
        period: {
          type: 'string',
          enum: ['week', 'month', 'all'],
          description: 'Time period for attribution summary. Default: "month".',
        },
      },
      required: [],
    },
  },
  {
    name: 'list_available_metrics',
    description:
      'List all distinct metric names available in the biometrics database for this user. Use this before calling query_biometrics to discover what metrics exist.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];
