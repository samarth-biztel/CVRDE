ALTER TABLE reassignments ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE due_date_extensions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
