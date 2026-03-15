-- Add structured sections column for rich 8-section reports
-- Nullable: old reports have sections = NULL, new reports populate it
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT NULL;
