-- Separate daily reports per company (Etna Group vs Dervisholli).
-- Apply via Supabase SQL editor or `supabase db push`.

alter table public.daily_reports
  add column if not exists company text not null default 'Etna Group'
    check (company in ('Etna Group', 'Dervisholli'));

alter table public.daily_reports
  drop constraint if exists daily_reports_date_key;

alter table public.daily_reports
  add constraint daily_reports_date_company_key unique (date, company);

create index if not exists daily_reports_date_company_idx
  on public.daily_reports (date desc, company);
