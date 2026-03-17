import { useDateRangeStore } from '../useDateRangeStore';

describe('useDateRangeStore', () => {
  beforeEach(() => {
    const today = new Date();
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(today.getDate() - 14);
    useDateRangeStore.setState({
      startDate: fourteenDaysAgo.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    });
  });

  it('defaults endDate to today in YYYY-MM-DD format', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(useDateRangeStore.getState().endDate).toBe(today);
  });

  it('defaults startDate to 14 days before endDate', () => {
    const { startDate, endDate } = useDateRangeStore.getState();
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(14);
  });

  it('setRange updates startDate and endDate', () => {
    useDateRangeStore.getState().setRange('2026-01-01', '2026-01-31');
    const { startDate, endDate } = useDateRangeStore.getState();
    expect(startDate).toBe('2026-01-01');
    expect(endDate).toBe('2026-01-31');
  });
});
