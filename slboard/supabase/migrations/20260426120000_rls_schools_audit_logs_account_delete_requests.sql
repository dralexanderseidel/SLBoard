-- RLS-Nachzug: schools + Legacy audit_logs; account_delete_requests wie DSGVO-Migration
-- Voraussetzungen: public.current_user_email(), public.current_school_number() (60410+)

-- Super-Admin ausschließlich über Rolle SUPER_ADMIN in user_roles (E-Mail-Whitelist nur in App)
create or replace function public.current_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users au
    join public.user_roles ur on ur.user_id = au.id
    where lower(au.email) = public.current_user_email()
      and ur.role_code = 'SUPER_ADMIN'
  );
$$;

-- ---------------------------------------------------------------------------
-- schools: Lesen für Mitglieder der Schule + Super-Admin; Schreiben nur Service-Role (keine User-Policies)
-- ---------------------------------------------------------------------------
alter table if exists public.schools enable row level security;

drop policy if exists schools_select_member_or_super_admin on public.schools;
create policy schools_select_member_or_super_admin
on public.schools
for select
to authenticated
using (
  exists (
    select 1
    from public.app_users au
    where lower(au.email) = public.current_user_email()
      and au.school_number = schools.school_number
  )
  or public.current_is_super_admin()
);

-- ---------------------------------------------------------------------------
-- audit_logs (Legacy): gleiches Muster wie audit_log, falls Spalte school_number existiert
-- ---------------------------------------------------------------------------
do $body$
begin
  if to_regclass('public.audit_logs') is null then
    raise notice 'audit_logs: Tabelle fehlt, übersprungen.';
    return;
  end if;

  alter table public.audit_logs enable row level security;

  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'audit_logs'
      and c.column_name = 'school_number'
  ) then
    execute $sql$
      drop policy if exists audit_logs_select_own_school on public.audit_logs;
    $sql$;
    execute $sql$
      create policy audit_logs_select_own_school
      on public.audit_logs
      for select
      to authenticated
      using (school_number = public.current_school_number());
    $sql$;
    execute $sql$
      drop policy if exists audit_logs_insert_own_school on public.audit_logs;
    $sql$;
    execute $sql$
      create policy audit_logs_insert_own_school
      on public.audit_logs
      for insert
      to authenticated
      with check (school_number = public.current_school_number());
    $sql$;
  elsif exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'audit_logs'
      and c.column_name = 'document_id'
  ) then
    execute $sql$
      drop policy if exists audit_logs_select_via_document on public.audit_logs;
    $sql$;
    execute $sql$
      create policy audit_logs_select_via_document
      on public.audit_logs
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.documents d
          where d.id = audit_logs.document_id
            and d.school_number = public.current_school_number()
        )
      );
    $sql$;
    execute $sql$
      drop policy if exists audit_logs_insert_via_document on public.audit_logs;
    $sql$;
    execute $sql$
      create policy audit_logs_insert_via_document
      on public.audit_logs
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.documents d
          where d.id = audit_logs.document_id
            and d.school_number = public.current_school_number()
        )
      );
    $sql$;
  else
    raise notice 'audit_logs: weder school_number noch document_id — keine Policies gesetzt.';
  end if;
end;
$body$;

-- ---------------------------------------------------------------------------
-- account_delete_requests: nur Backend (service_role); authenticated ohne Rechte
-- ---------------------------------------------------------------------------
alter table if exists public.account_delete_requests enable row level security;

revoke all on public.account_delete_requests from public;
revoke all on public.account_delete_requests from anon;
revoke all on public.account_delete_requests from authenticated;

grant select, insert, delete on public.account_delete_requests to service_role;
