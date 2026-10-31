ALTER TABLE projects ADD COLUMN IF NOT EXISTS stale_after_days integer NOT NULL DEFAULT 14;
ALTER TABLE projects ADD CONSTRAINT projects_stale_after_days_range CHECK (stale_after_days BETWEEN 1 AND 60);
