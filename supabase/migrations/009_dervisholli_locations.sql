-- Dervisholli work sites: Residio 8 (R8) and Residio 10 (R10).
-- Etna Group keeps Prishtinë / Prizren / Malishevë (Pr / Pz / M).

alter table public.attendance
  drop constraint if exists attendance_location_check;

alter table public.attendance
  add constraint attendance_location_check
  check (location in ('Pr', 'Pz', 'M', 'R8', 'R10'));
