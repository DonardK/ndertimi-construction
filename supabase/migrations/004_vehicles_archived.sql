-- Soft-delete for vehicles: hide from new entries while keeping fuel/service history.

alter table public.vehicles
  add column if not exists archived_at timestamptz;

create index if not exists idx_vehicles_archived_at on public.vehicles (archived_at);
