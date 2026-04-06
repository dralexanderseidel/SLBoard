-- Mehrere app_users-Zeilen pro E-Mail (eine pro Schule); Anmeldung mit Schulnummer + E-Mail.
-- E-Mail in app_users konsistent kleinschreiben.

update public.app_users
set email = lower(trim(email))
where email is not null;

update public.app_users
set school_number = '000000'
where school_number is null;

alter table public.app_users
  drop constraint if exists app_users_email_key;

create unique index if not exists app_users_email_school_uidx
  on public.app_users (email, school_number);

comment on index public.app_users_email_school_uidx is
  'Ein Nutzer kann dieselbe E-Mail in mehreren Schulen haben (je Zeile).';

-- JWT user_metadata.school_number (6-stellig) hat Vorrang; sonst genau eine app_users-Zeile pro E-Mail.
create or replace function public.current_school_number()
returns char(6)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  j text := trim(coalesce(auth.jwt()->'user_metadata'->>'school_number', ''));
  cnt int;
  sn char(6);
begin
  if j ~ '^[0-9]{6}$' then
    return j::char(6);
  end if;
  select count(*) into cnt
  from public.app_users au
  where lower(au.email) = public.current_user_email();
  if cnt = 1 then
    select au.school_number into sn
    from public.app_users au
    where lower(au.email) = public.current_user_email()
    limit 1;
    return sn;
  end if;
  return null;
end;
$$;
