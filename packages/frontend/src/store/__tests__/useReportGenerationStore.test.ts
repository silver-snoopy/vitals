import { describe, it, expect, beforeEach } from 'vitest';
import { useReportGenerationStore } from '../useReportGenerationStore';

describe('useReportGenerationStore', () => {
  beforeEach(() => {
    useReportGenerationStore.getState().reset();
  });

  it('starts with null state', () => {
    const state = useReportGenerationStore.getState();
    expect(state.pendingReportId).toBeNull();
    expect(state.status).toBeNull();
    expect(state.statusMessage).toBeNull();
  });

  it('sets pending state on startGeneration', () => {
    useReportGenerationStore.getState().startGeneration('report-123');
    const state = useReportGenerationStore.getState();
    expect(state.pendingReportId).toBe('report-123');
    expect(state.status).toBe('pending');
  });

  it('updates status and message', () => {
    useReportGenerationStore.getState().startGeneration('report-123');
    useReportGenerationStore.getState().updateStatus('generating', 'Building AI insights...');
    const state = useReportGenerationStore.getState();
    expect(state.status).toBe('generating');
    expect(state.statusMessage).toBe('Building AI insights...');
  });

  it('resets to initial state', () => {
    useReportGenerationStore.getState().startGeneration('report-123');
    useReportGenerationStore.getState().updateStatus('completed');
    useReportGenerationStore.getState().reset();
    const state = useReportGenerationStore.getState();
    expect(state.pendingReportId).toBeNull();
    expect(state.status).toBeNull();
    expect(state.statusMessage).toBeNull();
  });
});
