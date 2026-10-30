ALTER TABLE due_date_extensions ADD COLUMN IF NOT EXISTS decision_comment text;
ALTER TABLE reassignments ADD COLUMN IF NOT EXISTS decision_comment text;
ALTER TABLE reassignments ADD COLUMN IF NOT EXISTS decided_by bigint REFERENCES users(id);
