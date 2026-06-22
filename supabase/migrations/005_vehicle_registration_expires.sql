-- Vehicle registration expiration date.

alter table public.vehicles
  add column if not exists registration_expires_at date;

create index if not exists idx_vehicles_registration_expires_at
  on public.vehicles (registration_expires_at);
