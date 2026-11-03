ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS actor_id bigint REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS notification_user_history_idx ON notification_log(to_user_id,sent_at DESC,id DESC);
