-- Adds salary_type and fixed_salary to employees.
-- Apply via Supabase SQL editor or `supabase db push`.

alter table public.employees
  add column if not exists salary_type text not null default 'hourly'
    check (salary_type in ('hourly', 'fixed'));

alter table public.employees
  add column if not exists fixed_salary numeric default null;

-- Ensure cmimi_ore has default 0 if null
alter table public.employees
  alter column cmimi_ore set default 0;
