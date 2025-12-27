-- Add nudge columns to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS clock_out_nudge BOOLEAN DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nudge_time TEXT; -- Format HH:mm
