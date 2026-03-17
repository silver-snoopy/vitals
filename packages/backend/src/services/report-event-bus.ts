import { EventEmitter } from 'node:events';
import type { ReportStatusUpdate } from '@vitals/shared';

type StatusListener = (update: ReportStatusUpdate) => void;

class ReportEventBus {
  // Single-user app: one listener per report, but disable the default warning
  // to avoid false positives if multiple reconnects happen.
  private emitter = new EventEmitter({ captureRejections: false });

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  emit(reportId: string, update: ReportStatusUpdate): void {
    this.emitter.emit(reportId, update);
  }

  subscribe(reportId: string, listener: StatusListener): void {
    this.emitter.on(reportId, listener);
  }

  unsubscribe(reportId: string, listener: StatusListener): void {
    this.emitter.off(reportId, listener);
  }
}

export const reportEventBus = new ReportEventBus();
