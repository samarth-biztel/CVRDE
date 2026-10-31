CREATE TABLE meetings (
  id bigserial PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sub_project_id bigint,
  title text NOT NULL,
  meeting_date date NOT NULL,
  minutes text NOT NULL,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(sub_project_id,project_id) REFERENCES sub_projects(id,project_id)
);
CREATE TABLE meeting_attendees (
  meeting_id bigint NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES users(id),
  PRIMARY KEY(meeting_id,user_id)
);
ALTER TABLE tasks ADD COLUMN source_meeting_id bigint REFERENCES meetings(id);
CREATE INDEX meetings_project_date_idx ON meetings(project_id,meeting_date DESC,id DESC);
CREATE INDEX tasks_source_meeting_idx ON tasks(source_meeting_id);
