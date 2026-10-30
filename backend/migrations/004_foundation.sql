ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
UPDATE tasks SET status = CASE status WHEN 'NEW' THEN 'NOT_STARTED' WHEN 'COMPLETED' THEN 'DONE' ELSE status END;
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'NOT_STARTED';
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('NOT_STARTED','IN_PROGRESS','SUBMITTED','RETURNED','DONE'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100);
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS notification_user_unread_idx ON notification_log(to_user_id, sent_at DESC) WHERE read_at IS NULL;
