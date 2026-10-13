ALTER TABLE folders ADD COLUMN lww_at timestamptz(3), ADD COLUMN lww_device text;
ALTER TABLE lists ADD COLUMN lww_at timestamptz(3), ADD COLUMN lww_device text;
ALTER TABLE tags ADD COLUMN lww_at timestamptz(3), ADD COLUMN lww_device text;
ALTER TABLE tasks ADD COLUMN lww_at timestamptz(3), ADD COLUMN lww_device text;
ALTER TABLE habits ADD COLUMN lww_at timestamptz(3), ADD COLUMN lww_device text;
ALTER TABLE habit_records ADD COLUMN lww_at timestamptz(3), ADD COLUMN lww_device text;
ALTER TABLE focus_sessions ADD COLUMN lww_at timestamptz(3), ADD COLUMN lww_device text;
ALTER TABLE user_settings ADD COLUMN lww_at timestamptz(3), ADD COLUMN lww_device text;