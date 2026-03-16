-- Add status tracking for async report generation
ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Partial index for finding in-progress reports (most rows are 'completed')
CREATE INDEX IF NOT EXISTS idx_weekly_reports_status
  ON weekly_reports (user_id, status) WHERE status != 'completed';
