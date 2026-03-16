import { describe, it, expect, vi } from 'vitest';
import { reportEventBus } from '../report-event-bus.js';
import type { ReportStatusUpdate } from '@vitals/shared';

describe('ReportEventBus', () => {
  it('delivers events to subscribers', () => {
    const listener = vi.fn();
    const update: ReportStatusUpdate = {
      reportId: 'r1',
      status: 'generating',
      message: 'Working...',
    };

    reportEventBus.subscribe('r1', listener);
    reportEventBus.emit('r1', update);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(update);

    reportEventBus.unsubscribe('r1', listener);
  });

  it('does not deliver events after unsubscribe', () => {
    const listener = vi.fn();

    reportEventBus.subscribe('r2', listener);
    reportEventBus.unsubscribe('r2', listener);
    reportEventBus.emit('r2', { reportId: 'r2', status: 'completed' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('isolates events by reportId', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    reportEventBus.subscribe('r3', listener1);
    reportEventBus.subscribe('r4', listener2);

    reportEventBus.emit('r3', { reportId: 'r3', status: 'generating' });

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).not.toHaveBeenCalled();

    reportEventBus.unsubscribe('r3', listener1);
    reportEventBus.unsubscribe('r4', listener2);
  });
});
