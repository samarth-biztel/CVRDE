ALTER TABLE reassignments
  ADD COLUMN IF NOT EXISTS work_from date,
  ADD COLUMN IF NOT EXISTS work_until date;

ALTER TABLE reassignments
  ADD CONSTRAINT reassignment_work_window_order
  CHECK (work_from IS NULL OR work_until IS NULL OR work_until >= work_from);
