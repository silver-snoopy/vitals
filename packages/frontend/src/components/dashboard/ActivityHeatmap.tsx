import { useMemo, useState } from 'react';
import type { WorkoutSession } from '@vitals/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ActivityHeatmapProps {
  workouts: WorkoutSession[];
}

const CELL_SIZE = 14;
const CELL_GAP = 3;
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

function getIntensity(setCount: number): number {
  if (setCount === 0) return 0;
  if (setCount <= 10) return 1;
  if (setCount <= 20) return 2;
  return 3;
}

const INTENSITY_OPACITY = [0.1, 0.4, 0.7, 1.0];

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ActivityHeatmap({ workouts }: ActivityHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const { grid, weeks } = useMemo(() => {
    // Build a map of date → total sets
    const dateSetCount = new Map<string, number>();
    for (const session of workouts) {
      const date = session.date.slice(0, 10);
      const sets = session.sets?.length ?? 0;
      dateSetCount.set(date, (dateSetCount.get(date) ?? 0) + sets);
    }

    // Build grid: last N weeks ending today
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0
    const endOfWeek = new Date(today);

    // Go back to fill complete weeks
    const totalWeeks = 13;
    const startDate = new Date(endOfWeek);
    startDate.setDate(startDate.getDate() - dayOfWeek - (totalWeeks - 1) * 7);

    const cells: { date: string; row: number; col: number; sets: number }[] = [];
    const current = new Date(startDate);

    let col = 0;
    while (current <= today) {
      const row = (current.getDay() + 6) % 7; // Mon=0
      const dateStr = formatDate(current);
      const sets = dateSetCount.get(dateStr) ?? 0;
      cells.push({ date: dateStr, row, col, sets });

      current.setDate(current.getDate() + 1);
      if (row === 6) {
        col++;
      }
    }

    return { grid: cells, weeks: col + 1 };
  }, [workouts]);

  const svgWidth = weeks * (CELL_SIZE + CELL_GAP) + 30; // 30px for day labels
  const svgHeight = 7 * (CELL_SIZE + CELL_GAP);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <svg
            width={svgWidth}
            height={svgHeight + 4}
            className="block"
            role="img"
            aria-label="Workout activity heatmap"
          >
            {/* Day labels */}
            {DAY_LABELS.map((label, i) =>
              label ? (
                <text
                  key={i}
                  x={0}
                  y={i * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 2}
                  className="fill-muted-foreground"
                  fontSize={9}
                >
                  {label}
                </text>
              ) : null,
            )}

            {/* Heatmap cells */}
            {grid.map((cell) => {
              const intensity = getIntensity(cell.sets);
              return (
                <rect
                  key={cell.date}
                  x={30 + cell.col * (CELL_SIZE + CELL_GAP)}
                  y={cell.row * (CELL_SIZE + CELL_GAP)}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={2}
                  className="fill-primary"
                  style={{ opacity: INTENSITY_OPACITY[intensity] }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({
                      x: rect.x + rect.width / 2,
                      y: rect.y,
                      text:
                        cell.sets > 0
                          ? `${cell.date}: ${cell.sets} sets`
                          : `${cell.date}: Rest day`,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            })}
          </svg>
        </div>
        {tooltip && (
          <div
            className="pointer-events-none fixed z-50 rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
            style={{ left: tooltip.x, top: tooltip.y - 28, transform: 'translateX(-50%)' }}
          >
            {tooltip.text}
          </div>
        )}
        <div className="mt-2 flex items-center justify-end gap-1 text-xs text-muted-foreground">
          <span>Less</span>
          {INTENSITY_OPACITY.map((opacity, i) => (
            <div key={i} className="h-3 w-3 rounded-sm bg-primary" style={{ opacity }} />
          ))}
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}
