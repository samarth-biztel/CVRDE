CREATE TABLE IF NOT EXISTS sub_projects (
  id bigserial PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text NOT NULL DEFAULT '',
  owner_id bigint NOT NULL,
  due_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,project_id),
  UNIQUE(project_id,name),
  FOREIGN KEY(project_id,owner_id) REFERENCES project_members(project_id,user_id)
);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sub_project_id bigint;
ALTER TABLE tasks ADD CONSTRAINT tasks_sub_project_project_fk FOREIGN KEY(sub_project_id,project_id) REFERENCES sub_projects(id,project_id);
CREATE INDEX IF NOT EXISTS sub_projects_project_idx ON sub_projects(project_id);
CREATE INDEX IF NOT EXISTS tasks_sub_project_idx ON tasks(sub_project_id);
