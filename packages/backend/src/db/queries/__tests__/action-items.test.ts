import { describe, it, expect, vi } from 'vitest';
import {
  promoteActionItems,
  listActionItems,
  getActionItem,
  updateActionItemStatus,
  getActionItemSummary,
} from '../action-items.js';
import type pg from 'pg';

function makeMockPool(rows: unknown[]): pg.Pool {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as pg.Pool;
}

function makeMultiResponsePool(responses: unknown[][]): pg.Pool {
  const query = vi.fn();
  responses.forEach((rows) => query.mockResolvedValueOnce({ rows }));
  return { query } as unknown as pg.Pool;
}

const baseRow = {
  id: 'item-uuid-1',
  user_id: 'default',
  report_id: 'report-uuid-1',
  category: 'nutrition',
  priority: 'high',
  text: 'Increase protein intake to 150g/day',
  status: 'pending',
  target_metric: null,
  target_direction: null,
  baseline_value: null,
  outcome_value: null,
  outcome_confidence: null,
  outcome_measured_at: null,
  created_at: new Date('2026-03-22T08:00:00.000Z'),
  due_by: new Date('2026-03-29'),
  completed_at: null,
  status_changed_at: new Date('2026-03-22T08:00:00.000Z'),
};

describe('promoteActionItems', () => {
  it('inserts action items when none exist for the report', async () => {
    const pool = makeMultiResponsePool([[], []]);
    await promoteActionItems(pool, 'default', 'report-uuid-1', [
      { category: 'nutrition', priority: 'high', text: 'Eat more protein' },
    ]);
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    const insertCall = (pool.query as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(String(insertCall[0])).toMatch(/INSERT INTO action_items/);
  });

  it('skips insert if items already exist for the report (idempotent)', async () => {
    const pool = makeMultiResponsePool([[{ '?column?': 1 }]]);
    await promoteActionItems(pool, 'default', 'report-uuid-1', [
      { category: 'nutrition', priority: 'high', text: 'Eat more protein' },
    ]);
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it('does nothing if items array is empty', async () => {
    const pool = makeMockPool([]);
    await promoteActionItems(pool, 'default', 'report-uuid-1', []);
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });
});

describe('listActionItems', () => {
  it('returns mapped TrackedActionItem array', async () => {
    const pool = makeMockPool([baseRow]);
    const result = await listActionItems(pool, 'default');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('item-uuid-1');
    expect(result[0].reportId).toBe('report-uuid-1');
    expect(result[0].category).toBe('nutrition');
    expect(result[0].priority).toBe('high');
    expect(result[0].status).toBe('pending');
    expect(result[0].createdAt).toBe('2026-03-22T08:00:00.000Z');
  });

  it('returns empty array when no items', async () => {
    const pool = makeMockPool([]);
    const result = await listActionItems(pool, 'default');
    expect(result).toHaveLength(0);
  });

  it('applies status filter', async () => {
    const pool = makeMockPool([]);
    await listActionItems(pool, 'default', { status: ['pending', 'active'] });
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(call[0])).toMatch(/status = ANY/);
    expect(call[1]).toContain('default');
    expect(call[1]).toContainEqual(['pending', 'active']);
  });
});

describe('getActionItem', () => {
  it('returns item when found', async () => {
    const pool = makeMockPool([baseRow]);
    const result = await getActionItem(pool, 'item-uuid-1', 'default');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('item-uuid-1');
  });

  it('returns null when not found', async () => {
    const pool = makeMockPool([]);
    const result = await getActionItem(pool, 'nonexistent', 'default');
    expect(result).toBeNull();
  });
});

describe('updateActionItemStatus', () => {
  it('returns null when item not found', async () => {
    const pool = makeMockPool([]);
    const result = await updateActionItemStatus(pool, 'nonexistent', 'default', 'active');
    expect(result).toBeNull();
  });

  it('throws on invalid status transition', async () => {
    const pool = makeMultiResponsePool([[{ status: 'completed' }]]);
    await expect(updateActionItemStatus(pool, 'item-uuid-1', 'default', 'active')).rejects.toThrow(
      'Invalid status transition',
    );
  });

  it('performs valid transition pending → active', async () => {
    const updatedRow = { ...baseRow, status: 'active' };
    const pool = makeMultiResponsePool([[{ status: 'pending' }], [updatedRow]]);
    const result = await updateActionItemStatus(pool, 'item-uuid-1', 'default', 'active');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('active');
  });

  it('rejects invalid transition completed → active', async () => {
    const pool = makeMultiResponsePool([[{ status: 'completed' }]]);
    await expect(
      updateActionItemStatus(pool, 'item-uuid-1', 'default', 'active'),
    ).rejects.toThrow();
  });
});

describe('getActionItemSummary', () => {
  it('returns counts by status', async () => {
    const pool = makeMockPool([
      { status: 'pending', count: 3 },
      { status: 'active', count: 2 },
      { status: 'completed', count: 5 },
    ]);
    const result = await getActionItemSummary(pool, 'default');
    expect(result.pending).toBe(3);
    expect(result.active).toBe(2);
    expect(result.completed).toBe(5);
    expect(result.total).toBe(10);
  });

  it('returns zero counts when no items', async () => {
    const pool = makeMockPool([]);
    const result = await getActionItemSummary(pool, 'default');
    expect(result.pending).toBe(0);
    expect(result.total).toBe(0);
  });
});
