-- Add notes column to time_records
ALTER TABLE time_records ADD COLUMN IF NOT EXISTS notes TEXT;
