-- Phase 1 Multi-Client (Tenant) Vorbereitung
-- Tenant-Schluessel: school_number (6-stellig)

create table if not exists public.schools (
  school_number char(6) primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint schools_school_number_format_chk check (school_number ~ '^[0-9]{6}$')
);

-- Pilot-/Fallback-Schule fuer Bestandsdaten
insert into public.schools (school_number, name)
values ('000000', 'Pilotschule / Bestandsdaten')
on conflict (school_number) do nothing;

alter table if exists public.app_users
  add column if not exists school_number char(6);

alter table if exists public.documents
  add column if not exists school_number char(6);

alter table if exists public.document_versions
  add column if not exists school_number char(6);

alter table if exists public.audit_log
  add column if not exists school_number char(6);

alter table if exists public.ai_queries
  add column if not exists school_number char(6);

-- Bestandsdaten zunaechst einer Pilotschule zuordnen (uebergangsweise)
do $$
begin
  if to_regclass('public.app_users') is not null then
    update public.app_users set school_number = '000000' where school_number is null;
  end if;
  if to_regclass('public.documents') is not null then
    update public.documents set school_number = '000000' where school_number is null;
  end if;
  if to_regclass('public.document_versions') is not null then
    update public.document_versions set school_number = '000000' where school_number is null;
  end if;
  if to_regclass('public.audit_log') is not null then
    update public.audit_log set school_number = '000000' where school_number is null;
  end if;
  if to_regclass('public.ai_queries') is not null then
    update public.ai_queries set school_number = '000000' where school_number is null;
  end if;
end $$;

-- FKs nur anlegen, falls noch nicht vorhanden.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'app_users_school_number_fkey'
  ) then
    alter table public.app_users
      add constraint app_users_school_number_fkey
      foreign key (school_number) references public.schools(school_number);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_school_number_fkey'
  ) then
    alter table public.documents
      add constraint documents_school_number_fkey
      foreign key (school_number) references public.schools(school_number);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'document_versions_school_number_fkey'
  ) then
    alter table public.document_versions
      add constraint document_versions_school_number_fkey
      foreign key (school_number) references public.schools(school_number);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_log_school_number_fkey'
  ) then
    alter table public.audit_log
      add constraint audit_log_school_number_fkey
      foreign key (school_number) references public.schools(school_number);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_queries_school_number_fkey'
  ) then
    alter table public.ai_queries
      add constraint ai_queries_school_number_fkey
      foreign key (school_number) references public.schools(school_number);
  end if;
end $$;

do $$
begin
  if to_regclass('public.app_users') is not null then
    create index if not exists idx_app_users_school_number on public.app_users(school_number);
  end if;
  if to_regclass('public.documents') is not null then
    create index if not exists idx_documents_school_number_created_at on public.documents(school_number, created_at desc);
  end if;
  if to_regclass('public.document_versions') is not null then
    create index if not exists idx_document_versions_school_number_document_id on public.document_versions(school_number, document_id);
  end if;
  if to_regclass('public.audit_log') is not null then
    create index if not exists idx_audit_log_school_number_created_at on public.audit_log(school_number, created_at desc);
  end if;
  if to_regclass('public.ai_queries') is not null then
    create index if not exists idx_ai_queries_school_number_created_at on public.ai_queries(school_number, created_at desc);
  end if;
end $$;

