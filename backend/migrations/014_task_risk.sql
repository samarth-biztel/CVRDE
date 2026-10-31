ALTER TABLE tasks ADD COLUMN IF NOT EXISTS risk_flag boolean NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS risk_reason text;
ALTER TABLE tasks ADD CONSTRAINT tasks_risk_reason_check CHECK (NOT risk_flag OR nullif(trim(risk_reason),'') IS NOT NULL);
