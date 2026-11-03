ALTER TABLE meetings ADD COLUMN updated_by bigint REFERENCES users(id);
