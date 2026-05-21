-- Enable RLS and allow anon + authenticated full access to daily_reports,
-- matching the access pattern of the other tables (employees, attendance).
-- Apply via Supabase SQL editor or `supabase db push`.

alter table public.daily_reports enable row level security;

drop policy if exists "daily_reports select" on public.daily_reports;
drop policy if exists "daily_reports insert" on public.daily_reports;
drop policy if exists "daily_reports update" on public.daily_reports;
drop policy if exists "daily_reports delete" on public.daily_reports;

create policy "daily_reports select"
  on public.daily_reports
  for select
  to anon, authenticated
  using (true);

create policy "daily_reports insert"
  on public.daily_reports
  for insert
  to anon, authenticated
  with check (true);

create policy "daily_reports update"
  on public.daily_reports
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "daily_reports delete"
  on public.daily_reports
  for delete
  to anon, authenticated
  using (true);
