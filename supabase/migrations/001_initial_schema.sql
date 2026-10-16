-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- profiles table
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- departments table
create table departments (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_name_key unique (name)
);

-- ai_tools table
create table ai_tools (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_tools_name_key unique (name)
);

-- request_batches table
create table request_batches (
  id uuid primary key default uuid_generate_v4(),
  reference_number text not null unique,
  department_id uuid references departments(id),
  department_name_snapshot text not null,
  ai_tool_id uuid references ai_tools(id),
  ai_tool_name_snapshot text not null,
  submitted_by_name text,
  submitted_by_email text,
  submitted_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','partially_decided','approved','declined','completed')),
  finalized_at timestamptz,
  constraint request_batches_reference_number_key unique (reference_number)
);

-- access_requests table
create table access_requests (
  id uuid primary key default uuid_generate_v4(),
  batch_id uuid not null references request_batches(id) on delete cascade,
  employee_full_name text not null check (char_length(employee_full_name) <= 255),
  position text not null check (char_length(position) <= 255),
  employee_justification text not null check (char_length(employee_justification) <= 2000),
  ai_usage_justification text not null check (char_length(ai_usage_justification) <= 2000),
  expected_impact text not null check (char_length(expected_impact) <= 2000),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  decided_by uuid references profiles(user_id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- audit_logs table
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references profiles(user_id),
  action text not null check (action in ('approve','decline','bulk_approve','bulk_decline')),
  entity_type text not null,
  entity_id uuid not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- rate_limits table (for public submission rate limiting)
create table rate_limits (
  id uuid primary key default uuid_generate_v4(),
  ip_address text not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_request_batches_status on request_batches(status);
create index idx_request_batches_submitted_at on request_batches(submitted_at desc);
create index idx_access_requests_batch_id on access_requests(batch_id);
create index idx_access_requests_status on access_requests(status);
create index idx_rate_limits_ip_created on rate_limits(ip_address, created_at);

-- Trigger to recalculate batch status
create or replace function recalculate_batch_status()
returns trigger as $$
declare
  v_batch_id uuid;
  v_pending_count int;
  v_approved_count int;
  v_declined_count int;
  v_new_status text;
  v_is_finalized boolean;
begin
  v_batch_id := NEW.batch_id;

  -- Check if batch is finalized
  select finalized_at is not null into v_is_finalized from request_batches where id = v_batch_id;
  if v_is_finalized then
    raise exception 'Batch is already finalized';
  end if;

  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'approved'),
    count(*) filter (where status = 'declined')
  into v_pending_count, v_approved_count, v_declined_count
  from access_requests
  where batch_id = v_batch_id;

  if v_pending_count > 0 then
    if v_approved_count > 0 or v_declined_count > 0 then
      v_new_status := 'partially_decided';
    else
      v_new_status := 'pending';
    end if;
    update request_batches set status = v_new_status where id = v_batch_id;
  else
    if v_approved_count > 0 and v_declined_count = 0 then
      v_new_status := 'approved';
    elsif v_declined_count > 0 and v_approved_count = 0 then
      v_new_status := 'declined';
    else
      v_new_status := 'completed';
    end if;
    update request_batches
    set status = v_new_status, finalized_at = now()
    where id = v_batch_id;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger after_access_request_decision
after update of status on access_requests
for each row
when (OLD.status = 'pending' and NEW.status != 'pending')
execute function recalculate_batch_status();

-- Enable RLS
alter table profiles enable row level security;
alter table departments enable row level security;
alter table ai_tools enable row level security;
alter table request_batches enable row level security;
alter table access_requests enable row level security;
alter table audit_logs enable row level security;
alter table rate_limits enable row level security;

-- Helper function to check if current user is admin
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- RLS Policies

-- profiles: user can read their own
create policy "profiles_select_own" on profiles
  for select using (user_id = auth.uid());

-- departments: anon can read active ones
create policy "departments_select_active_anon" on departments
  for select using (is_active = true);

-- departments: admin full access
create policy "departments_admin_all" on departments
  for all using (is_admin());

-- ai_tools: anon can read active ones
create policy "ai_tools_select_active_anon" on ai_tools
  for select using (is_active = true);

-- ai_tools: admin full access
create policy "ai_tools_admin_all" on ai_tools
  for all using (is_admin());

-- request_batches: admin can read and update
create policy "request_batches_admin_select" on request_batches
  for select using (is_admin());

create policy "request_batches_admin_update" on request_batches
  for update using (is_admin());

-- access_requests: admin can read and update
create policy "access_requests_admin_select" on access_requests
  for select using (is_admin());

create policy "access_requests_admin_update" on access_requests
  for update using (is_admin());

-- audit_logs: admin can read and insert
create policy "audit_logs_admin_select" on audit_logs
  for select using (is_admin());

create policy "audit_logs_admin_insert" on audit_logs
  for insert with check (is_admin());

-- rate_limits: no direct access (only service role)
-- (no policies = no access for anon/authenticated roles)

-- Seed data (sample departments and AI tools)
insert into departments (name, is_active) values
  ('Engineering', true),
  ('Human Resources', true),
  ('Finance', true),
  ('Marketing', true),
  ('Operations', true);

insert into ai_tools (name, description, is_active) values
  ('GitHub Copilot', 'AI-powered code completion and generation tool', true),
  ('ChatGPT Enterprise', 'Conversational AI for business productivity', true),
  ('Microsoft Copilot', 'AI assistant integrated with Microsoft 365', true),
  ('Notion AI', 'AI writing and summarization in Notion', true),
  ('Grammarly Business', 'AI-powered writing assistance', true);
