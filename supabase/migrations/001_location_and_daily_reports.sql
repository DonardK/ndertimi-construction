-- Adds work location to attendance and creates daily_reports table.
-- Apply via Supabase SQL editor or `supabase db push`.

alter table public.attendance
  add column if not exists location text not null default 'Pr'
    check (location in ('Pr', 'Pz', 'M'));

create table if not exists public.daily_reports (
  id bigserial primary key,
  date date not null unique,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists daily_reports_date_idx on public.daily_reports (date desc);
