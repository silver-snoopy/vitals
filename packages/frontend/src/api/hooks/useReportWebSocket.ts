import { useEffect, useRef } from 'react';
import type { ReportStatusUpdate } from '@vitals/shared';

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

export function useReportWebSocket(
  reportId: string | null,
  onUpdate: (update: ReportStatusUpdate) => void,
): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!reportId) return;

    let ws: WebSocket | null = null;
    let retries = 0;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (closed) return;

      const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
      const wsUrl = apiUrl.replace(/^http/, 'ws');
      const token = import.meta.env.VITE_X_API_KEY ?? '';

      ws = new WebSocket(`${wsUrl}/ws/reports?reportId=${reportId}&token=${token}`);

      ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data as string) as ReportStatusUpdate;
          onUpdateRef.current(update);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = (event) => {
        if (closed) return;
        // Normal closure or terminal status — don't reconnect
        if (event.code === 1000) return;

        if (retries < MAX_RETRIES) {
          const delay = BASE_DELAY * 2 ** retries;
          retries++;
          retryTimer = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror — reconnect handled there
      };
    }

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
    };
  }, [reportId]);
}
