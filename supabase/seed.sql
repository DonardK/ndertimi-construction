-- Local development seed (applied automatically by `supabase start` /
-- `supabase db reset`). This file is NOT applied to the hosted project by
-- `supabase db push`, so it is safe to keep local-only bootstrap here.
--
-- 1) Grants: the hosted Supabase project grants table privileges to the
--    anon/authenticated roles via project default privileges. A from-scratch
--    local database has no such grants, so RLS policies alone are not enough
--    (PostgREST still needs table-level privileges). Grant them explicitly.
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

-- 2) A local test login. lib/roles.ts treats donard@etnagroup-ks.com as a
--    "management" account (full financial dashboard). With
--    NEXT_PUBLIC_AUTH_EMAIL_DOMAIN=etnagroup-ks.com you can log in with just the
--    username "donard" and password "password123".
create extension if not exists pgcrypto with schema extensions;
do $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = 'donard@etnagroup-ks.com';
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'donard@etnagroup-ks.com', extensions.crypt('password123', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      '', '', '', ''
    );
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      'donard@etnagroup-ks.com', uid,
      jsonb_build_object('sub', uid::text, 'email', 'donard@etnagroup-ks.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;
end $$;

-- 3) A little sample data so the dashboard and lists are not empty on first run.
insert into public.employees (emri, mbiemri, payment_method, cmimi_ore, emri_bankes, llogaria_bankes)
values
  ('Arben', 'Krasniqi', 'Cash', 4.50, null, null),
  ('Fatmir', 'Berisha', 'Bankë', 5.00, 'ProCredit Bank', 'XK05...1234')
on conflict do nothing;

insert into public.vehicles (emri_mjetit, targa)
values
  ('Kamion Mercedes', '01-234-AB'),
  ('Furgon VW', '02-567-CD')
on conflict do nothing;
