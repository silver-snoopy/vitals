import { useState } from 'react';
import type { ToolCallRecord } from '../../api/hooks/useChat';

const TOOL_LABELS: Record<string, string> = {
  query_nutrition: 'Queried nutrition data',
  query_workouts: 'Queried workout sessions',
  query_biometrics: 'Queried biometrics',
  query_exercise_progress: 'Queried exercise progress',
  get_latest_report: 'Fetched latest report',
  list_available_metrics: 'Listed available metrics',
};

interface Props {
  toolCalls: ToolCallRecord[];
}

export function ToolCallPanel({ toolCalls }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (toolCalls.length === 0) return null;

  return (
    <div className="mt-1 mb-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground hover:bg-muted/80 transition-colors"
      >
        <span className="text-[10px]">{expanded ? '▾' : '▸'}</span>
        {toolCalls.length === 1
          ? (TOOL_LABELS[toolCalls[0].toolName] ?? toolCalls[0].toolName)
          : `${toolCalls.length} data queries`}
      </button>

      {expanded && (
        <div className="mt-1.5 space-y-1.5 rounded-lg border border-border bg-muted/40 p-2 text-xs">
          {toolCalls.map((tc, i) => (
            <div key={i} className="space-y-0.5">
              <p className="font-medium text-foreground">
                {TOOL_LABELS[tc.toolName] ?? tc.toolName}
              </p>
              {Object.keys(tc.input).length > 0 && (
                <p className="text-muted-foreground">
                  {Object.entries(tc.input)
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
