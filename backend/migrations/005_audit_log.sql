CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY, project_id bigint REFERENCES projects(id) ON DELETE SET NULL,
  task_id bigint REFERENCES tasks(id) ON DELETE SET NULL,
  action text NOT NULL, actor_id bigint NOT NULL REFERENCES users(id),
  details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO audit_log(project_id,task_id,action,actor_id,details,created_at)
SELECT project_id,task_id,event_type,actor_id,details,created_at FROM task_history;
