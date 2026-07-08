-- Adds company dimension to attendance (Etna Group vs Dervisholli).
-- Apply via Supabase SQL editor or `supabase db push`.

alter table public.attendance
  add column if not exists company text not null default 'Etna Group'
    check (company in ('Etna Group', 'Dervisholli'));
