-- Erzwingt Passwortwechsel (z. B. nach verg. Admin-Initpasswort) und blockiert
-- heimliches Zurücksetzen per Supabase-Client: true -> false nur über Helferfunktion.

alter table if exists public.app_users
  add column if not exists password_change_required boolean not null default false;

comment on column public.app_users.password_change_required is
  'Ist true, muss der Nutzer sein (Init-)Passwort wechseln, bevor die App genutzt wird.';

-- Transaction-lokale Session-Variable erlaubt ausschließlich der definierten Helferfunktion.
create or replace function public.trg_guard_app_users_password_flag()
returns trigger
language plpgsql
as $fn$
begin
  if (tg_op = 'UPDATE' and
      coalesce(old.password_change_required, false) = true
      and coalesce(new.password_change_required, false) = false) then
    if coalesce(current_setting('app.password_change_bypass', true), '') = '1' then
      return new;
    end if;
    raise exception 'Kennung password_change_required darf nur systemseitig zurückgesetzt werden.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_app_users_password_flag on public.app_users;
create trigger trg_app_users_password_flag
  before update on public.app_users
  for each row
  execute procedure public.trg_guard_app_users_password_flag();

-- Wird ausschließlich vom API-Key mit service_role (oder direkt) ausgeführt.
create or replace function public.clear_user_password_change_required(
  p_email   text,
  p_school  char(6)
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform set_config('app.password_change_bypass', '1', true);
  update public.app_users
  set password_change_required = false
  where lower(email) = lower(trim(p_email)) and school_number = p_school
    and coalesce(password_change_required, false) = true;
end;
$fn$;

revoke all on function public.clear_user_password_change_required(text, char) from public;
grant execute on function public.clear_user_password_change_required(text, char) to service_role;
