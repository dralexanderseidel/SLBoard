-- Löschanfragen: Status + Bearbeitung; app_users: weiches Sperren (kein Schulzugriff)

alter table public.app_users
  add column if not exists active boolean not null default true;

comment on column public.app_users.active is
  'false: kein Zugriff auf Schul-Daten für diese Zeile (Admin kann deaktivieren). Auth-User bleibt bestehen, bis zur endgültigen Löschung.';

alter table public.account_delete_requests
  add column if not exists status text not null default 'pending';

alter table public.account_delete_requests
  add column if not exists admin_note text;

alter table public.account_delete_requests
  add column if not exists resolved_at timestamptz;

alter table public.account_delete_requests
  add column if not exists resolved_by_app_user_id uuid references public.app_users (id) on delete set null;

comment on column public.account_delete_requests.status is
  'pending | acknowledged | completed | rejected — Bearbeitung durch Schul-Admin.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'account_delete_requests_status_chk'
  ) then
    alter table public.account_delete_requests
      add constraint account_delete_requests_status_chk
      check (status in ('pending', 'acknowledged', 'completed', 'rejected'));
  end if;
end $$;
