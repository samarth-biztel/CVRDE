ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expected_deliverables text NOT NULL DEFAULT '';
