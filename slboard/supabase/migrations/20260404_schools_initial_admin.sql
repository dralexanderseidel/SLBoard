-- Erster Admin pro Schule (Schulregistrierung); Referenz für Löschschutz in der Admin-API
alter table if exists public.schools
  add column if not exists initial_admin_app_user_id uuid references public.app_users(id) on delete set null;

comment on column public.schools.initial_admin_app_user_id is
  'Bei Schulregistrierung angelegter Admin; darf nicht über die Admin-API gelöscht werden.';

-- Bestehende Schulen: ältester app_user pro Schule als Initial-Admin setzen (nur wo noch NULL)
update public.schools s
set initial_admin_app_user_id = u.id
from (
  select distinct on (school_number) school_number, id
  from public.app_users
  where school_number is not null
  order by school_number, created_at asc nulls last, id asc
) u
where s.school_number = u.school_number
  and s.initial_admin_app_user_id is null;
