-- Add type column to time_records
alter table time_records add column type text default 'work';

-- Update existing records to 'work' (safety)
update time_records set type = 'work' where type is null;
