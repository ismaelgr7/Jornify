-- Add last_nudge_at column to track the last time an employee was notified
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_nudge_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN employees.last_nudge_at IS 'Timestamp of the last push notification sent to avoid duplicates';

-- Enable Realtime for scheduled_reminders if not already enabled
ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_reminders;
