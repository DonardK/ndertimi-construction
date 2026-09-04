-- Role-based RLS: management vs staff (matches lib/roles.ts).
-- Management: full access. Staff: employees, attendance, daily_reports only.
-- Apply via Supabase SQL editor or `supabase db push`.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to postgres, service_role, authenticated;

create or replace function private.current_user_email()
returns text
language sql
stable
set search_path = private, public, auth
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function private.is_app_user()
returns boolean
language sql
stable
set search_path = private, public, auth
as $$
  select private.current_user_email() = any (
    array[
      'donard@etnagroup-ks.com',
      'diellona@etnagroup-ks.com',
      'staff@etnagroup-ks.com'
    ]
  );
$$;

create or replace function private.is_management()
returns boolean
language sql
stable
security definer
set search_path = private, public, auth
as $$
  select private.current_user_email() = any (
    array['donard@etnagroup-ks.com', 'diellona@etnagroup-ks.com']
  );
$$;

grant execute on function private.current_user_email() to authenticated;
grant execute on function private.is_app_user() to authenticated;
grant execute on function private.is_management() to authenticated;

-- Tag roles in auth app_metadata (safe for authorization; not user_metadata).
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"management"}'::jsonb
where lower(email) in ('donard@etnagroup-ks.com', 'diellona@etnagroup-ks.com');

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"staff"}'::jsonb
where lower(email) = 'staff@etnagroup-ks.com';

-- Drop legacy permissive policies
drop policy if exists "Allow all" on public.employees;
drop policy if exists "Allow all" on public.attendance;
drop policy if exists "Allow all" on public.vehicles;
drop policy if exists "Allow all" on public.diesel;
drop policy if exists "allow_all" on public.worker_payments;
drop policy if exists "vehicle_services_all" on public.vehicle_services;
drop policy if exists "stock_items_all" on public.stock_items;
drop policy if exists "office_expenses_all" on public.office_expenses;
drop policy if exists "daily_reports select" on public.daily_reports;
drop policy if exists "daily_reports insert" on public.daily_reports;
drop policy if exists "daily_reports update" on public.daily_reports;
drop policy if exists "daily_reports delete" on public.daily_reports;

alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.daily_reports enable row level security;
alter table public.vehicles enable row level security;
alter table public.diesel enable row level security;
alter table public.worker_payments enable row level security;
alter table public.vehicle_services enable row level security;
alter table public.stock_items enable row level security;
alter table public.office_expenses enable row level security;

-- Staff + management tables
create policy "employees_select" on public.employees
  for select to authenticated using (private.is_app_user());
create policy "employees_insert" on public.employees
  for insert to authenticated with check (private.is_app_user());
create policy "employees_update" on public.employees
  for update to authenticated
  using (private.is_app_user()) with check (private.is_app_user());
create policy "employees_delete" on public.employees
  for delete to authenticated using (private.is_app_user());

create policy "attendance_select" on public.attendance
  for select to authenticated using (private.is_app_user());
create policy "attendance_insert" on public.attendance
  for insert to authenticated with check (private.is_app_user());
create policy "attendance_update" on public.attendance
  for update to authenticated
  using (private.is_app_user()) with check (private.is_app_user());
create policy "attendance_delete" on public.attendance
  for delete to authenticated using (private.is_app_user());

create policy "daily_reports_select" on public.daily_reports
  for select to authenticated using (private.is_app_user());
create policy "daily_reports_insert" on public.daily_reports
  for insert to authenticated with check (private.is_app_user());
create policy "daily_reports_update" on public.daily_reports
  for update to authenticated
  using (private.is_app_user()) with check (private.is_app_user());
create policy "daily_reports_delete" on public.daily_reports
  for delete to authenticated using (private.is_app_user());

-- Management-only tables
create policy "vehicles_select" on public.vehicles
  for select to authenticated using (private.is_management());
create policy "vehicles_insert" on public.vehicles
  for insert to authenticated with check (private.is_management());
create policy "vehicles_update" on public.vehicles
  for update to authenticated
  using (private.is_management()) with check (private.is_management());
create policy "vehicles_delete" on public.vehicles
  for delete to authenticated using (private.is_management());

create policy "diesel_select" on public.diesel
  for select to authenticated using (private.is_management());
create policy "diesel_insert" on public.diesel
  for insert to authenticated with check (private.is_management());
create policy "diesel_update" on public.diesel
  for update to authenticated
  using (private.is_management()) with check (private.is_management());
create policy "diesel_delete" on public.diesel
  for delete to authenticated using (private.is_management());

create policy "worker_payments_select" on public.worker_payments
  for select to authenticated using (private.is_management());
create policy "worker_payments_insert" on public.worker_payments
  for insert to authenticated with check (private.is_management());
create policy "worker_payments_update" on public.worker_payments
  for update to authenticated
  using (private.is_management()) with check (private.is_management());
create policy "worker_payments_delete" on public.worker_payments
  for delete to authenticated using (private.is_management());

create policy "vehicle_services_select" on public.vehicle_services
  for select to authenticated using (private.is_management());
create policy "vehicle_services_insert" on public.vehicle_services
  for insert to authenticated with check (private.is_management());
create policy "vehicle_services_update" on public.vehicle_services
  for update to authenticated
  using (private.is_management()) with check (private.is_management());
create policy "vehicle_services_delete" on public.vehicle_services
  for delete to authenticated using (private.is_management());

create policy "stock_items_select" on public.stock_items
  for select to authenticated using (private.is_management());
create policy "stock_items_insert" on public.stock_items
  for insert to authenticated with check (private.is_management());
create policy "stock_items_update" on public.stock_items
  for update to authenticated
  using (private.is_management()) with check (private.is_management());
create policy "stock_items_delete" on public.stock_items
  for delete to authenticated using (private.is_management());

create policy "office_expenses_select" on public.office_expenses
  for select to authenticated using (private.is_management());
create policy "office_expenses_insert" on public.office_expenses
  for insert to authenticated with check (private.is_management());
create policy "office_expenses_update" on public.office_expenses
  for update to authenticated
  using (private.is_management()) with check (private.is_management());
create policy "office_expenses_delete" on public.office_expenses
  for delete to authenticated using (private.is_management());
