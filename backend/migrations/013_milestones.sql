CREATE TABLE IF NOT EXISTS milestones (
  id bigserial PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  due_date date NOT NULL,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,project_id)
);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS milestone_id bigint;
ALTER TABLE tasks ADD CONSTRAINT tasks_milestone_project_fk FOREIGN KEY(milestone_id,project_id) REFERENCES milestones(id,project_id);
CREATE INDEX IF NOT EXISTS milestones_project_idx ON milestones(project_id,due_date);
CREATE INDEX IF NOT EXISTS tasks_milestone_idx ON tasks(milestone_id);
