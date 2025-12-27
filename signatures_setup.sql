-- Create Monthly Signatures table
create table monthly_signatures (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  month integer not null,
  year integer not null,
  signature_data text not null, -- base64 image
  signed_at timestamp with time zone default now(),
  verification_hash text,
  unique(employee_id, month, year)
);

-- Enable Realtime for this table
alter publication supabase_realtime add table monthly_signatures;
