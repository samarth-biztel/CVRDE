CREATE TABLE IF NOT EXISTS users (
  id bigserial PRIMARY KEY, username text UNIQUE NOT NULL, password_hash text NOT NULL,
  full_name text NOT NULL, email text NOT NULL, role text NOT NULL CHECK(role IN ('PM','MEMBER','REVIEWER')),
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id bigserial PRIMARY KEY, name text NOT NULL, description text NOT NULL DEFAULT '',
  target_date date, manager_id bigint NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project_members (
  project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(project_id,user_id)
);
CREATE TABLE IF NOT EXISTS project_groups (
  id bigserial PRIMARY KEY, project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL, description text NOT NULL DEFAULT '', can_view_results boolean NOT NULL DEFAULT false,
  can_comment boolean NOT NULL DEFAULT true, can_link_pendency boolean NOT NULL DEFAULT true,
  created_by bigint NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,name), UNIQUE(id,project_id)
);
CREATE TABLE IF NOT EXISTS group_members (
  group_id bigint NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by bigint NOT NULL REFERENCES users(id), added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(group_id,user_id)
);
CREATE TABLE IF NOT EXISTS tasks (
  id bigserial PRIMARY KEY, project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id bigint REFERENCES tasks(id), title text NOT NULL, description text NOT NULL DEFAULT '',
  owner_id bigint NOT NULL REFERENCES users(id), priority text NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW','MEDIUM','HIGH')),
  due_date date, status text NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','IN_PROGRESS','SUBMITTED','COMPLETED')),
  visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility IN ('PRIVATE','GROUP')),
  group_id bigint, plm_ref text, created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK((visibility='PRIVATE' AND group_id IS NULL) OR (visibility='GROUP' AND group_id IS NOT NULL)),
  CHECK(parent_task_id IS NULL OR parent_task_id<>id),
  FOREIGN KEY(group_id,project_id) REFERENCES project_groups(id,project_id)
);
CREATE TABLE IF NOT EXISTS task_comments (
  id bigserial PRIMARY KEY, task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id bigint NOT NULL REFERENCES users(id), body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS task_results (
  id bigserial PRIMARY KEY, task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  version_no integer NOT NULL, work_completed text NOT NULL, outcome text NOT NULL,
  submitted_by bigint NOT NULL REFERENCES users(id), submitted_at timestamptz NOT NULL DEFAULT now(),
  review_status text NOT NULL DEFAULT 'PENDING' CHECK(review_status IN ('PENDING','ACCEPTED','RETURNED')),
  review_comment text, reviewed_by bigint REFERENCES users(id), reviewed_at timestamptz,
  UNIQUE(task_id,version_no)
);
CREATE TABLE IF NOT EXISTS attachments (
  id bigserial PRIMARY KEY, project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id bigint REFERENCES tasks(id) ON DELETE CASCADE, result_id bigint REFERENCES task_results(id) ON DELETE SET NULL,
  document_key text NOT NULL, version_no integer NOT NULL, original_name text NOT NULL,
  stored_name text NOT NULL UNIQUE, mime_type text NOT NULL, size_bytes bigint NOT NULL,
  uploaded_by bigint NOT NULL REFERENCES users(id), uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id,document_key,version_no)
);
CREATE TABLE IF NOT EXISTS task_history (
  id bigserial PRIMARY KEY, project_id bigint NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id bigint REFERENCES tasks(id) ON DELETE CASCADE, event_type text NOT NULL,
  actor_id bigint NOT NULL REFERENCES users(id), details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reassignments (
  id bigserial PRIMARY KEY, task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  original_owner_id bigint NOT NULL REFERENCES users(id), new_owner_id bigint NOT NULL REFERENCES users(id),
  reason text NOT NULL, requested_by bigint NOT NULL REFERENCES users(id),
  reviewer_id bigint NOT NULL REFERENCES users(id), status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
  decided_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_reassignment ON reassignments(task_id) WHERE status='PENDING';
CREATE TABLE IF NOT EXISTS due_date_extensions (
  id bigserial PRIMARY KEY, task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requested_by bigint NOT NULL REFERENCES users(id), old_due_date date, new_due_date date NOT NULL,
  reason text NOT NULL, status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
  decided_by bigint REFERENCES users(id), decided_at timestamptz
);
CREATE TABLE IF NOT EXISTS pendencies (
  id bigserial PRIMARY KEY, raised_by bigint NOT NULL REFERENCES users(id),
  blocked_task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  responsible_user_id bigint NOT NULL REFERENCES users(id),
  type text NOT NULL CHECK(type IN ('ACTION','CLARIFICATION','APPROVAL')),
  description text NOT NULL, needs_approval boolean NOT NULL DEFAULT true,
  approver_id bigint REFERENCES users(id), status text NOT NULL DEFAULT 'AWAITING_APPROVAL'
    CHECK(status IN ('OPEN','AWAITING_APPROVAL','RESOLVED','REJECTED')),
  resolution text, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz
);
CREATE TABLE IF NOT EXISTS pendency_dependencies (
  pendency_id bigint NOT NULL REFERENCES pendencies(id) ON DELETE CASCADE,
  depends_on_task_id bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY(pendency_id,depends_on_task_id)
);
CREATE TABLE IF NOT EXISTS notification_log (
  id bigserial PRIMARY KEY, event_type text NOT NULL, to_user_id bigint NOT NULL REFERENCES users(id),
  task_id bigint REFERENCES tasks(id) ON DELETE SET NULL, subject text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(), delivery_status text NOT NULL, error text
);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_owner_idx ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS history_task_idx ON task_history(task_id,created_at);
