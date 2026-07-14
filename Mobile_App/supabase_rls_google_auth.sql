-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- Links employees to real Supabase Auth identities and locks down row access
-- so an employee can only read/write their own data.

alter table employees add column if not exists auth_user_id uuid unique references auth.users(id);

alter table employees enable row level security;
alter table attendance_records enable row level security;
alter table agencies enable row level security;

-- EMPLOYEES ------------------------------------------------------------

-- See your own linked row
create policy "employees_select_own" on employees
  for select using (auth_user_id = auth.uid());

-- See your own pre-registered (HR-created, not yet claimed) row, so it can be claimed
create policy "employees_select_unclaimed_by_email" on employees
  for select using (auth_user_id is null and email = (auth.jwt() ->> 'email'));

-- Claim a pre-registered row on first sign-in
create policy "employees_claim_unclaimed_row" on employees
  for update using (auth_user_id is null and email = (auth.jwt() ->> 'email'))
  with check (auth_user_id = auth.uid());

-- Update your own already-linked row
create policy "employees_update_own" on employees
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Self-register if no pre-registered row exists yet
create policy "employees_insert_self" on employees
  for insert with check (auth_user_id = auth.uid() and email = (auth.jwt() ->> 'email'));

-- ATTENDANCE_RECORDS ----------------------------------------------------

create policy "attendance_select_own" on attendance_records
  for select using (
    employee_id in (select id from employees where auth_user_id = auth.uid())
  );

create policy "attendance_insert_own" on attendance_records
  for insert with check (
    employee_id in (select id from employees where auth_user_id = auth.uid())
  );

create policy "attendance_update_own" on attendance_records
  for update using (
    employee_id in (select id from employees where auth_user_id = auth.uid())
  );

-- AGENCIES ----------------------------------------------------------------
-- Read-only reference data (name, network_config, etc.) needed by any signed-in employee

create policy "agencies_select_authenticated" on agencies
  for select using (auth.role() = 'authenticated');
