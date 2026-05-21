-- Run this in Supabase SQL Editor (or as a migration) before using Serviset / Stoku / Shpenzimet.

create table if not exists public.vehicle_services (
  id bigint generated always as identity primary key,
  vehicle_id bigint not null references public.vehicles (id) on delete restrict,
  emri_mjetit text not null,
  date date not null,
  notes text,
  items jsonb not null default '[]'::jsonb,
  total_price numeric not null,
  photo_base64 text,
  created_at timestamptz default now()
);

create table if not exists public.stock_items (
  id bigint generated always as identity primary key,
  category text not null,
  name text not null,
  quantity numeric not null default 0,
  unit text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.office_expenses (
  id bigint generated always as identity primary key,
  date date not null,
  category text not null,
  title text not null,
  amount numeric not null,
  notes text,
  photo_base64 text,
  created_at timestamptz default now()
);

create index if not exists idx_vehicle_services_date on public.vehicle_services (date desc);
create index if not exists idx_stock_items_category on public.stock_items (category);
create index if not exists idx_office_expenses_date on public.office_expenses (date desc);

alter table public.vehicle_services enable row level security;
alter table public.stock_items enable row level security;
alter table public.office_expenses enable row level security;

-- Match your existing tables: allow anon read/write if you use anon key from the app.
drop policy if exists "vehicle_services_all" on public.vehicle_services;
drop policy if exists "stock_items_all" on public.stock_items;
drop policy if exists "office_expenses_all" on public.office_expenses;

create policy "vehicle_services_all" on public.vehicle_services for all using (true) with check (true);
create policy "stock_items_all" on public.stock_items for all using (true) with check (true);
create policy "office_expenses_all" on public.office_expenses for all using (true) with check (true);
