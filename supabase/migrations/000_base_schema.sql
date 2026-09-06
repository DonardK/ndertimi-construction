-- Base schema for local development.
--
-- The core business tables below were originally created directly in the
-- hosted Supabase project (via the SQL editor), so they were never captured as
-- migrations. The other migration files in this folder are incremental ALTERs
-- that assume these tables already exist. This migration reconstructs the
-- documented base schema (see AI_KNOWLEDGE_TRANSFER.md → "Table Definitions")
-- so `supabase start` / `supabase db reset` can build a complete database from
-- scratch.
--
-- Every statement is idempotent (`create table if not exists`, guarded
-- policies), so applying this against an existing database that already has the
-- tables is a no-op and does not modify or drop existing data.

-- employees
create table if not exists public.employees (
  id              bigserial primary key,
  emri            text not null,
  mbiemri         text not null,
  payment_method  text not null,
  cmimi_ore       numeric not null,
  emri_bankes     text,
  llogaria_bankes text,
  created_at      timestamptz not null default now()
);

-- attendance (location column added by 001, company added by 007)
create table if not exists public.attendance (
  id             bigserial primary key,
  employee_id    bigint not null references public.employees (id),
  emri           text not null,
  mbiemri        text not null,
  date           date not null,
  payment_method text not null,
  hours_worked   numeric not null,
  created_at     timestamptz not null default now()
);

-- vehicles (archived_at added by 004, registration_expires_at added by 005)
create table if not exists public.vehicles (
  id          bigserial primary key,
  emri_mjetit text not null,
  targa       text not null,
  created_at  timestamptz not null default now()
);

-- diesel
create table if not exists public.diesel (
  id           bigserial primary key,
  vehicle_id   bigint not null references public.vehicles (id),
  emri_mjetit  text not null,
  date         date not null,
  liters       numeric not null,
  total_price  numeric not null,
  photo_base64 text,
  created_at   timestamptz not null default now()
);

-- worker_payments
create table if not exists public.worker_payments (
  id          bigserial primary key,
  employee_id bigint not null references public.employees (id),
  emri        text not null,
  mbiemri     text not null,
  amount      numeric not null,
  pershkrim   text not null,
  date        date not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_attendance_date on public.attendance (date desc);
create index if not exists idx_diesel_date on public.diesel (date desc);
create index if not exists idx_worker_payments_date on public.worker_payments (date desc);

-- RLS: permissive "allow everything" pattern, matching the hosted project.
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.vehicles enable row level security;
alter table public.diesel enable row level security;
alter table public.worker_payments enable row level security;

drop policy if exists "employees_all" on public.employees;
drop policy if exists "attendance_all" on public.attendance;
drop policy if exists "vehicles_all" on public.vehicles;
drop policy if exists "diesel_all" on public.diesel;
drop policy if exists "worker_payments_all" on public.worker_payments;

create policy "employees_all" on public.employees for all using (true) with check (true);
create policy "attendance_all" on public.attendance for all using (true) with check (true);
create policy "vehicles_all" on public.vehicles for all using (true) with check (true);
create policy "diesel_all" on public.diesel for all using (true) with check (true);
create policy "worker_payments_all" on public.worker_payments for all using (true) with check (true);
