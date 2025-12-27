create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password text not null,
  pin text unique not null,
  owner_id uuid,
  created_at timestamp with time zone default now()
);

-- Create Employees table
create table employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password text not null,
  company_pin text references companies(pin),
  company_id uuid references companies(id),
  contracted_hours_per_week integer default 40,
  user_id uuid,
  created_at timestamp with time zone default now()
);

-- Create Time Records table
create table time_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  employee_name text,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  duration_minutes integer default 0,
  created_at timestamp with time zone default now()
);

-- Enable Realtime for these tables
alter publication supabase_realtime add table companies;
alter publication supabase_realtime add table employees;
alter publication supabase_realtime add table time_records;
