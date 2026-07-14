-- Run this in the Supabase SQL Editor for project weqskfbsrwmlguygrgts.
-- Safe to run even though the original (role-less) profiles table already
-- exists — every statement below is idempotent (IF NOT EXISTS / DROP...IF
-- EXISTS then CREATE). Adds role-based access control on top of the
-- existing profiles table, plus a fix (see bottom of file) for a pre-existing
-- RLS gap that was silently blocking all dashboard admins from reading any
-- data at all.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz default now()
);

alter table profiles add column if not exists role text not null default 'front_desk';
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('super_admin', 'it', 'hr', 'front_desk'));

-- Bootstrap: only promote automatically if you're still the sole account
-- today. Scoped to "exactly one row" (not "any front_desk row") so re-running
-- this script later, once real front-desk staff exist, can't wrongly
-- promote them.
do $$
begin
  if (select count(*) from profiles) = 1 then
    update profiles set role = 'super_admin';
  end if;
end $$;

alter table profiles enable row level security;

-- ============================================================================
-- FIX for "infinite recursion detected in policy for relation profiles":
-- a policy defined ON profiles that also queries profiles (even via EXISTS)
-- re-triggers RLS evaluation on itself and Postgres correctly refuses to
-- evaluate it. The standard fix is a SECURITY DEFINER helper function — when
-- called from a policy, its internal query runs as the function's owner
-- (the role that created it, e.g. via the SQL Editor) rather than the
-- calling user, which is exempt from the same-table RLS check and so
-- doesn't recurse.
-- ============================================================================
create or replace function public.current_profile_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

-- Can update your own row; a trigger (not a policy subquery, to avoid the
-- same recursion) blocks changing your own role.
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

create or replace function public.prevent_self_role_change()
returns trigger as $$
begin
  if auth.uid() = old.id and new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_prevent_self_role_change on profiles;
create trigger trg_prevent_self_role_change
  before update on profiles
  for each row execute function public.prevent_self_role_change();

drop policy if exists "admin_read_all_profiles" on profiles;
create policy "admin_read_all_profiles" on profiles
  for select using (public.current_profile_role() in ('super_admin', 'it'));

drop policy if exists "admin_manage_profiles" on profiles;
create policy "admin_manage_profiles" on profiles
  for update using (public.current_profile_role() in ('super_admin', 'it'));

-- First-ever signup becomes super_admin (bootstrap, relevant if profiles is
-- ever emptied out). Everyone after defaults to front_desk (least
-- privilege) and must be promoted by a super_admin/it user via the Users page.
create or replace function public.handle_new_profile()
returns trigger as $$
declare
  v_role text := case when exists (select 1 from public.profiles) then 'front_desk' else 'super_admin' end;
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', v_role)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_profile();

-- Restrict agency WiFi-config edits to admin-tier roles. The dashboard UI
-- already only shows the edit control to these roles, but RLS is the real
-- enforcement — a direct API call bypassing the UI must not work either.
drop policy if exists "admin_update_agencies" on agencies;
create policy "admin_update_agencies" on agencies
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'it', 'hr'))
  );

-- ============================================================================
-- CRITICAL FIX — discovered while testing the dashboard: an earlier RLS setup
-- (written for the mobile app's own employee self-service login, applied to
-- this same database independently of later local code reverts) already
-- restricts employees/attendance_records/agencies SELECT to auth.uid()
-- matching employees.auth_user_id. Dashboard admins aren't employees, so they
-- match nothing and get zero rows back — this is why Overview/Reports/
-- Employees/Agencies all looked empty. These additive policies grant anyone
-- with a profiles row (i.e., every dashboard user, any role — Employees/
-- Agencies pages already restrict which roles can reach the UI for these,
-- per the RequireRole component) read access, OR'd alongside whatever
-- employee-scoped policies already exist.
-- ============================================================================
drop policy if exists "dashboard_admin_read_employees" on employees;
create policy "dashboard_admin_read_employees" on employees
  for select using (exists (select 1 from profiles where id = auth.uid()));

drop policy if exists "dashboard_admin_read_attendance" on attendance_records;
create policy "dashboard_admin_read_attendance" on attendance_records
  for select using (exists (select 1 from profiles where id = auth.uid()));

drop policy if exists "dashboard_admin_read_agencies" on agencies;
create policy "dashboard_admin_read_agencies" on agencies
  for select using (exists (select 1 from profiles where id = auth.uid()));
