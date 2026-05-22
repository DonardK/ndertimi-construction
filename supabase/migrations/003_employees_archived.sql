-- Soft-delete for employees: hide from hour logging while keeping history.

alter table public.employees
  add column if not exists archived_at timestamptz;

create index if not exists idx_employees_archived_at on public.employees (archived_at);
