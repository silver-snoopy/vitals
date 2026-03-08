import { describe, it, expect, vi } from 'vitest';
import {
  getReportById,
  getLatestReport,
  listReports,
  saveReport,
  logAiGeneration,
} from '../reports.js';
import type pg from 'pg';

function makeMockPool(rows: unknown[]): pg.Pool {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as pg.Pool;
}

const baseReportRow = {
  id: 'report-uuid-1',
  user_id: 'user-uuid',
  period_start: '2026-02-23',
  period_end: '2026-03-01',
  summary: 'A solid week of training.',
  insights: 'Good progress on strength metrics.',
  action_items: [{ category: 'nutrition', priority: 'high', text: 'Increase protein.' }],
  data_coverage: { nutritionDays: 7, workoutDays: 5, biometricDays: 7 },
  ai_provider: 'claude',
  ai_model: 'claude-sonnet-4-20250514',
  created_at: new Date('2026-03-01T08:00:00.000Z'),
};

describe('getReportById', () => {
  it('returns mapped WeeklyReport when found', async () => {
    const pool = makeMockPool([baseReportRow]);
    const result = await getReportById(pool, 'report-uuid-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('report-uuid-1');
    expect(result!.userId).toBe('user-uuid');
    expect(result!.summary).toBe('A solid week of training.');
    expect(result!.insights).toBe('Good progress on strength metrics.');
    expect(result!.actionItems).toHaveLength(1);
    expect(result!.actionItems[0].category).toBe('nutrition');
    expect(result!.dataCoverage.nutritionDays).toBe(7);
    expect(result!.aiProvider).toBe('claude');
    expect(result!.aiModel).toBe('claude-sonnet-4-20250514');
  });

  it('returns null when not found', async () => {
    const pool = makeMockPool([]);
    const result = await getReportById(pool, 'nonexistent-uuid');
    expect(result).toBeNull();
  });

  it('queries by id', async () => {
    const pool = makeMockPool([]);
    await getReportById(pool, 'my-id');
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['my-id']);
  });
});

describe('getLatestReport', () => {
  it('returns the latest report for user', async () => {
    const pool = makeMockPool([baseReportRow]);
    const result = await getLatestReport(pool, 'user-uuid');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('report-uuid-1');
  });

  it('returns null when no reports exist', async () => {
    const pool = makeMockPool([]);
    const result = await getLatestReport(pool, 'user-uuid');
    expect(result).toBeNull();
  });
});

describe('listReports', () => {
  it('returns all reports for user without date filters', async () => {
    const pool = makeMockPool([baseReportRow, { ...baseReportRow, id: 'report-uuid-2' }]);
    const result = await listReports(pool, 'user-uuid');
    expect(result).toHaveLength(2);
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls[0][1]).toEqual(['user-uuid']);
  });

  it('applies startDate filter when provided', async () => {
    const pool = makeMockPool([]);
    await listReports(pool, 'user-uuid', '2026-02-01');
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(params).toContain('2026-02-01');
  });

  it('applies both date filters when provided', async () => {
    const pool = makeMockPool([]);
    await listReports(pool, 'user-uuid', '2026-02-01', '2026-03-07');
    const params = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(params).toContain('2026-02-01');
    expect(params).toContain('2026-03-07');
  });

  it('returns empty array when no reports match', async () => {
    const pool = makeMockPool([]);
    const result = await listReports(pool, 'user-uuid');
    expect(result).toEqual([]);
  });
});

describe('saveReport', () => {
  it('inserts report and returns new UUID', async () => {
    const pool = makeMockPool([{ id: 'new-uuid' }]);
    const report = {
      userId: 'user-uuid',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-07',
      summary: 'Great week!',
      insights: 'Strength is improving.',
      actionItems: [
        { category: 'workout' as const, priority: 'medium' as const, text: 'Add more volume.' },
      ],
      dataCoverage: { nutritionDays: 7, workoutDays: 5, biometricDays: 7 },
      aiProvider: 'claude' as const,
      aiModel: 'claude-sonnet-4-20250514',
    };

    const id = await saveReport(pool, report);

    expect(id).toBe('new-uuid');
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('INSERT INTO weekly_reports');
    expect(call[0]).toContain('RETURNING id');
    // Verify JSONB columns are JSON-stringified
    expect(call[1][4]).toBe(JSON.stringify(report.insights));
    expect(call[1][5]).toBe(JSON.stringify(report.actionItems));
    expect(call[1][6]).toBe(JSON.stringify(report.dataCoverage));
  });
});

describe('logAiGeneration', () => {
  it('inserts ai_generation row', async () => {
    const pool = makeMockPool([]);
    await logAiGeneration(pool, {
      userId: 'user-uuid',
      provider: 'claude',
      model: 'claude-sonnet-4-20250514',
      promptTokens: 1200,
      completionTokens: 800,
      totalTokens: 2000,
      purpose: 'weekly_report',
    });

    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('INSERT INTO ai_generations');
    expect(call[1]).toContain('user-uuid');
    expect(call[1]).toContain('weekly_report');
    expect(call[1]).toContain(1200);
  });
});
