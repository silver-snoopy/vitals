import type pg from 'pg';
import type { ActionItem } from '@vitals/shared';

/**
 * Expire action items past their due_by date.
 * Only expires pending/active items — completed/deferred/etc are left alone.
 */
export async function expireStaleItems(pool: pg.Pool, userId: string): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE action_items
     SET status = 'expired', status_changed_at = now()
     WHERE user_id = $1
       AND status IN ('pending', 'active')
       AND due_by < CURRENT_DATE`,
    [userId],
  );
  return rowCount ?? 0;
}

/**
 * Simple keyword overlap check for superseding logic.
 * Returns a ratio (0-1) of shared significant words.
 */
function keywordOverlap(textA: string, textB: string): number {
  const toWords = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );

  const wordsA = toWords(textA);
  const wordsB = toWords(textB);

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let shared = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) shared++;
  }

  // Ratio against the smaller set
  const smaller = Math.min(wordsA.size, wordsB.size);
  return shared / smaller;
}

/**
 * Supersede old pending items when a new report generates replacements in the same category.
 * Conservative: only supersedes `pending` items, never `active` ones.
 */
export async function supersedeItems(
  pool: pg.Pool,
  userId: string,
  reportId: string,
  newItems: ActionItem[],
): Promise<number> {
  // Get existing pending items (not from the new report)
  const { rows: existingRows } = await pool.query(
    `SELECT id, category, text FROM action_items
     WHERE user_id = $1
       AND status = 'pending'
       AND report_id != $2`,
    [userId, reportId],
  );

  const toSupersede: string[] = [];

  for (const existing of existingRows) {
    const category = String(existing.category);
    const text = String(existing.text);
    const id = String(existing.id);

    // Check if any new item in the same category has high keyword overlap
    const hasReplacement = newItems.some(
      (ni) => ni.category === category && keywordOverlap(text, ni.text) > 0.7,
    );

    // Also supersede if new report has an item in the same category
    // (simple approach from plan: same category = supersede pending)
    const sameCategoryNewItem = newItems.some((ni) => ni.category === category);

    if (hasReplacement || sameCategoryNewItem) {
      toSupersede.push(id);
    }
  }

  if (toSupersede.length === 0) return 0;

  const { rowCount } = await pool.query(
    `UPDATE action_items
     SET status = 'superseded', status_changed_at = now()
     WHERE id = ANY($1) AND user_id = $2`,
    [toSupersede, userId],
  );

  return rowCount ?? 0;
}

// Exported for testing
export { keywordOverlap };
