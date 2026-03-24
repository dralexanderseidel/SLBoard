-- Multi-Tenant RLS (school_number-basiert)
-- Hinweis: Service-Role umgeht RLS weiterhin. Diese Policies schützen v. a. Client-Zugriffe.

-- ---------------------------------------------------------------------------
-- Helper-Funktionen (Email/School/Admin)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.current_school_number()
returns char(6)
language sql
stable
security definer
set search_path = public
as $$
  select au.school_number
  from public.app_users au
  where lower(au.email) = public.current_user_email()
  limit 1
$$;

create or replace function public.current_is_admin()
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
      and ur.role_code in ('SCHULLEITUNG', 'ADMIN')
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS documents
-- ---------------------------------------------------------------------------
alter table if exists public.documents enable row level security;

drop policy if exists documents_select_own_school on public.documents;
create policy documents_select_own_school
on public.documents
for select
to authenticated
using (school_number = public.current_school_number());

drop policy if exists documents_insert_own_school on public.documents;
create policy documents_insert_own_school
on public.documents
for insert
to authenticated
with check (school_number = public.current_school_number());

drop policy if exists documents_update_own_school on public.documents;
create policy documents_update_own_school
on public.documents
for update
to authenticated
using (school_number = public.current_school_number())
with check (school_number = public.current_school_number());

drop policy if exists documents_delete_own_school on public.documents;
create policy documents_delete_own_school
on public.documents
for delete
to authenticated
using (school_number = public.current_school_number());

-- ---------------------------------------------------------------------------
-- RLS document_versions
-- ---------------------------------------------------------------------------
alter table if exists public.document_versions enable row level security;

drop policy if exists document_versions_select_own_school on public.document_versions;
create policy document_versions_select_own_school
on public.document_versions
for select
to authenticated
using (school_number = public.current_school_number());

drop policy if exists document_versions_insert_own_school on public.document_versions;
create policy document_versions_insert_own_school
on public.document_versions
for insert
to authenticated
with check (school_number = public.current_school_number());

drop policy if exists document_versions_update_own_school on public.document_versions;
create policy document_versions_update_own_school
on public.document_versions
for update
to authenticated
using (school_number = public.current_school_number())
with check (school_number = public.current_school_number());

drop policy if exists document_versions_delete_own_school on public.document_versions;
create policy document_versions_delete_own_school
on public.document_versions
for delete
to authenticated
using (school_number = public.current_school_number());

-- ---------------------------------------------------------------------------
-- RLS ai_queries
-- ---------------------------------------------------------------------------
alter table if exists public.ai_queries enable row level security;

drop policy if exists ai_queries_select_own_school on public.ai_queries;
create policy ai_queries_select_own_school
on public.ai_queries
for select
to authenticated
using (school_number = public.current_school_number());

drop policy if exists ai_queries_insert_own_school on public.ai_queries;
create policy ai_queries_insert_own_school
on public.ai_queries
for insert
to authenticated
with check (school_number = public.current_school_number());

drop policy if exists ai_queries_update_own_school on public.ai_queries;
create policy ai_queries_update_own_school
on public.ai_queries
for update
to authenticated
using (school_number = public.current_school_number())
with check (school_number = public.current_school_number());

drop policy if exists ai_queries_delete_own_school on public.ai_queries;
create policy ai_queries_delete_own_school
on public.ai_queries
for delete
to authenticated
using (school_number = public.current_school_number());

-- ---------------------------------------------------------------------------
-- RLS audit_log
-- ---------------------------------------------------------------------------
alter table if exists public.audit_log enable row level security;

drop policy if exists audit_log_select_own_school on public.audit_log;
create policy audit_log_select_own_school
on public.audit_log
for select
to authenticated
using (school_number = public.current_school_number());

drop policy if exists audit_log_insert_own_school on public.audit_log;
create policy audit_log_insert_own_school
on public.audit_log
for insert
to authenticated
with check (school_number = public.current_school_number());

-- ---------------------------------------------------------------------------
-- RLS app_users
-- ---------------------------------------------------------------------------
alter table if exists public.app_users enable row level security;

drop policy if exists app_users_select_own_school on public.app_users;
create policy app_users_select_own_school
on public.app_users
for select
to authenticated
using (school_number = public.current_school_number());

drop policy if exists app_users_update_own_school on public.app_users;
create policy app_users_update_own_school
on public.app_users
for update
to authenticated
using (
  school_number = public.current_school_number()
  and (
    lower(email) = public.current_user_email()
    or public.current_is_admin()
  )
)
with check (school_number = public.current_school_number());

-- ---------------------------------------------------------------------------
-- RLS user_roles (kein school_number in Tabelle -> Join auf app_users)
-- ---------------------------------------------------------------------------
alter table if exists public.user_roles enable row level security;

drop policy if exists user_roles_select_own_school on public.user_roles;
create policy user_roles_select_own_school
on public.user_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.app_users au
    where au.id = user_roles.user_id
      and au.school_number = public.current_school_number()
  )
);

drop policy if exists user_roles_modify_admin_own_school on public.user_roles;
create policy user_roles_modify_admin_own_school
on public.user_roles
for all
to authenticated
using (
  public.current_is_admin()
  and exists (
    select 1
    from public.app_users au
    where au.id = user_roles.user_id
      and au.school_number = public.current_school_number()
  )
)
with check (
  public.current_is_admin()
  and exists (
    select 1
    from public.app_users au
    where au.id = user_roles.user_id
      and au.school_number = public.current_school_number()
  )
);

