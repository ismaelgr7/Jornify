-- Add hashing columns to time_records for cryptographic integrity
alter table time_records add column if not exists row_hash text;
alter table time_records add column if not exists parent_hash text;

-- Create an index to quickly find the latest record for hash chain verification
create index if not exists idx_time_records_employee_start on time_records(employee_id, start_time desc);
